export default function delay(milliseconds: number): Promise<void> {
	return new Promise<void>((resolve) => {
		const tt = setTimeout(() => {
			clearTimeout(tt)
			return resolve();
		}, milliseconds);
	});
}
