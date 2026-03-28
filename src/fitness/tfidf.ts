// ---------------------------------------------------------------------------
// TF-IDF engine: WDF×IDF sparse vectors, cosine similarity, Levenshtein.
//
// Algorithm:
//   WDF(t, d) = log2(freq(t,d) + 1) / log2(|d| + 1)
//   IDF(t)    = log2(N / df(t))          (df = doc freq, N = total docs)
//   score     = WDF × IDF
//
// Cosine similarity uses pre-normalized vectors so dot-product = cosine.
// Pairwise matrix is upper-triangle only (key = minUrl + '\0' + maxUrl).
//
// Levenshtein uses two-row Uint16Array rolling window: O(min(m,n)) space.
// ---------------------------------------------------------------------------

export interface TfidfVector {
	/** Raw WDF×IDF term scores (before normalization). */
	raw: Map<string, number>;
	/** Normalized term scores (raw / L2 magnitude). Used for cosine dot-product. */
	normalized: Map<string, number>;
	/** L2 magnitude of the raw vector. */
	magnitude: number;
	/** Top-N distinctive terms, ordered by raw score descending. */
	topTerms: string[];
}

export interface TfidfIndex {
	/** Page URL → TF-IDF vector. */
	vectors: Map<string, TfidfVector>;
	/**
	 * Pairwise cosine similarity.
	 * Key: `${minUrl}\0${maxUrl}` (lexicographic order to avoid duplicates).
	 */
	similarities: Map<string, number>;
	/** Pairwise normalized Levenshtein similarity of page titles. */
	titleSimilarities: Map<string, number>;
	/** Pairwise normalized Levenshtein similarity of page descriptions. */
	descSimilarities: Map<string, number>;
}

export interface TfidfInput {
	url: string;
	text: string;
	title: string;
	description: string;
}

const TOP_TERMS_COUNT = 10;

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

/**
 * Compute Levenshtein edit distance between two strings.
 * Uses two-row rolling Uint16Array for O(min(m,n)) space.
 */
export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	// Keep `a` as the shorter string to minimize column count
	if (a.length > b.length) {
		const tmp = a;
		a = b;
		b = tmp;
	}
	const n = a.length;
	const m = b.length;
	let prev = new Uint16Array(n + 1);
	let curr = new Uint16Array(n + 1);
	for (let i = 0; i <= n; i++) prev[i] = i;
	for (let j = 1; j <= m; j++) {
		curr[0] = j;
		for (let i = 1; i <= n; i++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[i] = Math.min(
				(prev[i] ?? 0) + 1, // deletion
				(curr[i - 1] ?? 0) + 1, // insertion
				(prev[i - 1] ?? 0) + cost, // substitution
			);
		}
		// Swap rows (reuse allocation)
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}
	return prev[n] ?? 0;
}

/**
 * Normalized Levenshtein similarity in [0, 1].
 * 1 = identical, 0 = maximally different.
 */
export function levenshteinSimilarity(a: string, b: string): number {
	const maxLen = Math.max(a.length, b.length);
	if (maxLen === 0) return 1;
	return 1 - levenshtein(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// TF-IDF build
// ---------------------------------------------------------------------------

/**
 * Build a TF-IDF index from a set of documents.
 *
 * @param docs  Array of { url, text, title, description } documents.
 * @param tokenize  Language-specific tokenizer (already strips stopwords).
 */
export function buildTfidf(docs: TfidfInput[], tokenize: (text: string) => string[]): TfidfIndex {
	const N = docs.length;

	if (N === 0) {
		return {
			vectors: new Map(),
			similarities: new Map(),
			titleSimilarities: new Map(),
			descSimilarities: new Map(),
		};
	}

	// Step 1: tokenize all documents, collect term frequencies and doc-freq counts
	const termFreqs: Array<Map<string, number>> = [];
	const docLengths: number[] = [];
	const docFreq = new Map<string, number>(); // how many docs contain each term

	for (const doc of docs) {
		const tokens = tokenize(doc.text);
		const freq = new Map<string, number>();
		for (const t of tokens) {
			freq.set(t, (freq.get(t) ?? 0) + 1);
		}
		termFreqs.push(freq);
		docLengths.push(tokens.length);
		for (const t of freq.keys()) {
			docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
		}
	}

	// Step 2: compute WDF×IDF vectors per document
	const vectors = new Map<string, TfidfVector>();
	for (let i = 0; i < docs.length; i++) {
		const doc = docs[i] as TfidfInput;
		const freq = termFreqs[i] as Map<string, number>;
		const docLen = docLengths[i] ?? 0;
		const raw = new Map<string, number>();

		for (const [term, tf] of freq) {
			const df = docFreq.get(term) ?? 1;
			const wdf = Math.log2(tf + 1) / Math.log2(docLen + 2); // +2 avoids log(1)=0
			const idf = Math.log2(N / df);
			if (idf > 0) {
				raw.set(term, wdf * idf);
			}
		}

		// Compute L2 magnitude
		let mag = 0;
		for (const v of raw.values()) mag += v * v;
		mag = Math.sqrt(mag);

		// Normalize
		const normalized = new Map<string, number>();
		if (mag > 0) {
			for (const [t, v] of raw) normalized.set(t, v / mag);
		}

		// Top terms (sorted by raw score)
		const topTerms = [...raw.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, TOP_TERMS_COUNT)
			.map(([t]) => t);

		vectors.set(doc.url, { raw, normalized, magnitude: mag, topTerms });
	}

	// Step 3: pairwise cosine similarity (upper triangle)
	const similarities = new Map<string, number>();
	const urlList = docs.map((d) => d.url);

	for (let i = 0; i < urlList.length; i++) {
		for (let j = i + 1; j < urlList.length; j++) {
			const ua = urlList[i] as string;
			const ub = urlList[j] as string;
			const va = vectors.get(ua);
			const vb = vectors.get(ub);
			if (!va || !vb) continue;

			const cosine = dotProduct(va.normalized, vb.normalized);
			const key = pairKey(ua, ub);
			similarities.set(key, cosine);
		}
	}

	// Step 4: pairwise title and description Levenshtein similarity
	const titleSimilarities = new Map<string, number>();
	const descSimilarities = new Map<string, number>();

	for (let i = 0; i < docs.length; i++) {
		for (let j = i + 1; j < docs.length; j++) {
			const da = docs[i] as TfidfInput;
			const db = docs[j] as TfidfInput;
			const key = pairKey(da.url, db.url);
			titleSimilarities.set(
				key,
				levenshteinSimilarity(da.title.toLowerCase(), db.title.toLowerCase()),
			);
			descSimilarities.set(
				key,
				levenshteinSimilarity(da.description.toLowerCase(), db.description.toLowerCase()),
			);
		}
	}

	return { vectors, similarities, titleSimilarities, descSimilarities };
}

// ---------------------------------------------------------------------------
// Retrieval helpers
// ---------------------------------------------------------------------------

/** Retrieve cosine similarity for a pair of URLs (order-independent). */
export function getCosineSimilarity(index: TfidfIndex, urlA: string, urlB: string): number {
	return index.similarities.get(pairKey(urlA, urlB)) ?? 0;
}

/** Retrieve title Levenshtein similarity for a pair of URLs. */
export function getTitleSimilarity(index: TfidfIndex, urlA: string, urlB: string): number {
	return index.titleSimilarities.get(pairKey(urlA, urlB)) ?? 0;
}

/** Retrieve description Levenshtein similarity for a pair of URLs. */
export function getDescSimilarity(index: TfidfIndex, urlA: string, urlB: string): number {
	return index.descSimilarities.get(pairKey(urlA, urlB)) ?? 0;
}

/**
 * Get the top shared terms between two pages (terms both vectors have).
 * Sorted by average of the two raw scores.
 */
export function getSharedTerms(index: TfidfIndex, urlA: string, urlB: string, limit = 5): string[] {
	const va = index.vectors.get(urlA);
	const vb = index.vectors.get(urlB);
	if (!va || !vb) return [];

	const shared: Array<[string, number]> = [];
	for (const [term, scoreA] of va.raw) {
		const scoreB = vb.raw.get(term);
		if (scoreB !== undefined) {
			shared.push([term, (scoreA + scoreB) / 2]);
		}
	}
	return shared
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([t]) => t);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Dot product of two sparse vectors. Iterates over the smaller one. */
function dotProduct(a: Map<string, number>, b: Map<string, number>): number {
	// Iterate over smaller vector for performance
	const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
	let sum = 0;
	for (const [term, va] of smaller) {
		const vb = larger.get(term);
		if (vb !== undefined) sum += va * vb;
	}
	return Math.min(1, Math.max(0, sum)); // clamp floating-point drift
}

/** Canonical pair key: lexicographically smaller URL first. */
function pairKey(ua: string, ub: string): string {
	return ua < ub ? `${ua}\0${ub}` : `${ub}\0${ua}`;
}
