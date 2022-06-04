import {MyScreenUser} from "./base";
import {YouTubeVideoStream} from "./yt";

export type MediaControlHandlerActions =
	'onPlay'
	| 'onStop'
	| 'onRewind'
	| 'onFastForward'
	| 'onOpenMenu'
	| 'onCloseMenu';

export interface MediaControlHandler {
	onPlay: (user: MyScreenUser) => Promise<void>;
	onStop: (user: MyScreenUser,) => Promise<void>;
	onRewind: (user: MyScreenUser) => Promise<void>;
	onFastForward: (user: MyScreenUser) => Promise<void>;
	onOpenMenu: (user: MyScreenUser) => Promise<void>;
	onCloseMenu: (user: MyScreenUser) => Promise<void>;
	handlePlayButtonClick: (user: MyScreenUser, stream: YouTubeVideoStream) => Promise<void>;
	// handlePlayButtonClick: (user: SoloUser, syncVideoStream: SynchronizedUserVideoStream) => Promise<void>;
	// canShowSelections: (user: SoloUser) => Promise<boolean>;
	// resetMRE: (user: SoloUser) => Promise<void>;
	// onSelectMode: (user: SoloUser, selectedOption: ModeSelectionOption) => Promise<void>
}
