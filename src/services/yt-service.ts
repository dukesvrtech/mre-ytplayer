import {YoutubeSearchResult, YouTubeVideoStream} from "../models/yt";
import nodeCache from 'node-cache';
import ytdl from 'ytdl-core';
import {secondsToString} from "../utils";
import * as process from "process";
import {Pager} from "../models/base";

const shortYTCache = new nodeCache({deleteOnExpire: true, stdTTL: 60, useClones: false})
const cookie = process.env.YOU_TUBE_COOKIE;
export const getVideoStreamFromYT = async (id: string): Promise<YouTubeVideoStream> => {
	try {
		const cacheKey = `yt-${id}`
		const videoStream = shortYTCache.get(cacheKey);
		if (videoStream) {
			return videoStream as YouTubeVideoStream;
		}

		const info = await ytdl.getInfo(id, {
			requestOptions: {
				headers: {
					cookie,
					// Optional. If not given, ytdl-core will try to find it.
					// You can find this by going to a video's watch page, viewing the source,
					// and searching for "ID_TOKEN".
					'x-youtube-identity-token': process.env.YOU_TUBE_CLIENT_ID,
				},
			},
		});
		if (info?.videoDetails) {
			const {videoDetails: {title, lengthSeconds, thumbnail: {thumbnails}}} = info;
			const ytVideoStream: YouTubeVideoStream = {
				duration: secondsToString(parseInt(lengthSeconds, 10)),
				enabled: true,
				id,
				photoUrl: thumbnails?.[0]?.url,
				sbs: "full",
				streamCount: 0,
				title,
				uri: "<onClick>",
			}
			let format = info?.formats.find(f => f.itag === 22);
			if (!format) {
				format = info?.formats.find(f => f.itag === 18);
			}
			if (!format) {
				const hls = info?.formats?.find(f => f.isHLS);
				if (hls) {
					ytVideoStream.uri = hls?.url;
					ytVideoStream.live = true;
					ytVideoStream.duration = "23:59:59";
				}
			} else {
				ytVideoStream.uri = format.url + '&.mp4';
			}
			shortYTCache.set(cacheKey, ytVideoStream, 600);
			return ytVideoStream;
		}
		console.error("Could  not find a youtube format that works", id);
	} catch (err) {
		console.error("Video not working", id, err);
	}
	return null;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const youtubesearchapi = require('youtube-search-api');

export const searchYoutube = (q: string): Promise<YoutubeSearchResult> => {
	const result = youtubesearchapi.GetListByKeyword(q, false, 100);
	return result;
}

export const getVideoStreamFromSearch = async (search: string, pager?: Pager): Promise<YouTubeVideoStream[]> => {
	const ytResults = await searchYoutube(search);
	const vidStreams: YouTubeVideoStream[] = [];
	for (const item of ytResults?.items) {
		const {id, thumbnail, title, length, type} = item;
		if (type !== 'video') {
			continue;
		}
		const vidStream: YouTubeVideoStream = {
			duration: length?.simpleText,
			enabled: true,
			id,
			photoUrl: thumbnail?.thumbnails?.[0].url,
			sbs: "full",
			streamCount: 0,
			title,
			uri: "<onClick>",
			author: item?.shortBylineText?.runs?.[0].text || 'unlisted',
		}

		vidStreams.push(vidStream);
		if (vidStreams.length >= pager.totalCount) {
			break;
		}
	}
	return vidStreams;
}

