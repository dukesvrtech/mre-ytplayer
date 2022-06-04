
export function secondsToString(seconds: number) {
	const norm = (val: number) => val < 10 ? `0${val}` : val;
	const numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
	const numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
	const numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;

	return `${norm(numhours)}:${norm(numminutes)}:${norm(Math.floor(numseconds))}`;
	// return ''
	//     + (numhours > 0 ? numhours + " hou   r(s) " : '')
	//     + (numminutes > 0 ? numminutes + " minute(s) " : '')
	//     + Math.floor(numseconds) + " seconds";
}

export const hmsToSecondsOnly = (str = '') => {
	const p = str.split(':');
	let s = 0;
	let m = 1;

	while (p.length > 0) {
		s += m * parseInt(p.pop(), 10);
		m *= 60;
	}
	return s;
}

// const safeDestroy = (actor: MRE.Actor): undefined => {
// 	if (actor) {
// 		try {
// 			actor.destroy();
// 		} catch (err) {
//
// 		}
// 	}
// 	return undefined;
// }
