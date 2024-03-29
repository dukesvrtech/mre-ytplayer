import Timeout = NodeJS.Timeout;
import * as MRE from "@microsoft/mixed-reality-extension-sdk";
import {YouTubeVideoStream} from "./yt";

export type Pager = {
	start: number;
	pageSize: number;
	displayed: boolean;
	totalCount: number;
	numberPages?: number;
}
export type DukeAds = {
	dukeAdsId: string;
	dukeAdsRerunTime?: number;
}
export type MyScreenContext = MRE.Context & {
	videoActor?: MRE.Actor;
	playerControls?: MRE.Actor;
	selectionTitlePanel?: MRE.Actor;
	updatePlayerTitle?: (title: string) => void;
	searchTerm?: string;

	playButton?: MRE.Actor;
	stopButton?: MRE.Actor;
	rewindButton?: MRE.Actor;
	fastFwdButton?: MRE.Actor;
	menuButton?: MRE.Actor;
	volumeUpButton?: MRE.Actor;
	volumeDownButton?: MRE.Actor;
	volumeLabel?: MRE.Actor;

	rolloffUpButton?: MRE.Actor;
	rolloffDownButton?: MRE.Actor;
	rolloffDistanceLabel?: MRE.Actor;

	onScreenControlsButton?: MRE.Actor;
	controlsHidden?: boolean;

	remainingTimeLabel?: MRE.Actor;
	updateRemainingTime?: (val: number) => void;

	ignoreClicks?: boolean;

	state?: 'playing' | 'paused' | 'stopped';
	currentVideoStream?: YouTubeVideoStream;
	soundOptions?: MRE.SetVideoStateOptions;

	ytSelectionPanel?: MRE.Actor;

	ytSelectionsPager?: Pager;
	pagerButtons?: {
		nextPageButton: MRE.Actor;
		prevPageButton: MRE.Actor;
		closeButton: MRE.Actor;
	};
	ytPagerButtons?: {
		closeButton: MRE.Actor;
	};
	progress?: Progress;
	currentStreamIntervalInterval?: Timeout;

	advertisement?: DukeAds;
	dukeAdslastPlayTimestamp?: number;
	dukeAdsPlayActive?: boolean;
	dukeAdsProgress?: Progress;
}
export type MyScreenUser = MRE.User & {};

export type Progress = {
	startTime: number;
	runningTime: number;
}
