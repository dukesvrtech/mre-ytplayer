import {MyScreenUser} from "./base";
import {YouTubeVideoStream} from "./yt";

export type MediaControlHandlerActions =
	'onPlay'
	| 'onStop'
	| 'onRewind'
	| 'onFastForward'
	| 'onOpenMenu'
	| 'onCloseMenu'

export interface MediaControlHandler {
	onPlay: (user: MyScreenUser) => Promise<void>;
	onStop: (user: MyScreenUser,) => Promise<void>;
	onRewind: (user: MyScreenUser) => Promise<void>;
	onFastForward: (user: MyScreenUser) => Promise<void>;
	onOpenMenu: (user: MyScreenUser) => Promise<void>;
	onCloseMenu: (user: MyScreenUser) => Promise<void>;
	onVolumeChange: (direction: 'up' | 'down') => void;
	onRolloffDistanceChange: (direction: 'up' | 'down') => void;
	handlePlayButtonClick: (user: MyScreenUser, stream: YouTubeVideoStream) => Promise<void>;
	setOnScreenControlsClick: () => void;
}
