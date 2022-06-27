/**
 *
 * @param predicate Block until predicate function returns true
 * @param giveUp
 */
export const block = (predicate: () => boolean, giveUp = 5000) => new Promise<void>((resolve, reject) => {
	const timestamp = Date.now();
	setInterval(() => {
		if (predicate()) {
			return resolve();
		} else if (Date.now() - timestamp >= giveUp) {
			return reject(new Error("Took too long and now giving up"))
		}
	}, 1)
});

export default block;
