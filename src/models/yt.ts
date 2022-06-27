import * as MRE from '@microsoft/mixed-reality-extension-sdk';

type Thumbnail = {
	url: string;
	width: number;
	height: number;
}

export interface YouTubeVideoStream {
	id: string;
	videoStream?: MRE.VideoStream;
	startTime?: number;
	streamCount?: number;
	duration?: string;
	uri?: string;
	photoUrl?: string;
	sbs?: "half" | "full" | "2D";
	enabled?: boolean;
	title?: string;
	author?: string;
	live?: boolean;
}

export type YoutubeSearchResult = {
	items: YoutubeSearchResultItem[];
}
export type YoutubeSearchResultItem = {
	"id": string;
	"type": "video";
	"thumbnail": {
		"thumbnails": Thumbnail[];
	};
	"title": string;
	"channelTitle": string;
	"length": {
		"simpleText": string;
	};
	"isLive": boolean;
	"shortBylineText": any;
};
export type YoutubeFormats = YoutubeFormat[];
export type YoutubeFormat = {
	vbr: number;
	format_note: string;
	vcodec: string;
	format_id: string;
	fps: number;
	height: number;
	protocol: string;
	width: number;
	filesize: number;
	acodec: string;
	quality: number;
	url: string;
	tbr: number;
	ext: 'mp4';
	container: "webm_dash";
	format: string;
}
