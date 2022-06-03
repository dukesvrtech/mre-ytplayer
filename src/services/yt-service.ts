import {YoutubeSearchResult, YouTubeVideoStream} from "../models/yt";
import nodeCache from 'node-cache';
import ytdl from 'ytdl-core';
import {secondsToString} from "../utils";
import * as process from "process";
import {Pager} from "../models/base";

const shotYTCache = new nodeCache({ deleteOnExpire: true, stdTTL: 60, useClones: false })
const cookie = process.env.YOU_TUBE_COOKIE;
export const getVideoStreamFromYT = async (id: string): Promise<YouTubeVideoStream> => {
	try {
		const cacheKey = `yt-${id}`
		const videoStream = shotYTCache.get(cacheKey);
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
			const format = info?.formats.find(f => f.itag === 18);
			if (!format) {
				const hls = info?.formats?.find(f => f.isHLS);
				if (hls) {
					ytVideoStream.uri = hls?.url;
					ytVideoStream.live = true;
					ytVideoStream.duration = "99:99:99";
				}
			} else {
				ytVideoStream.uri = format.url + '&.mp4';
			}
			shotYTCache.set(cacheKey, ytVideoStream, 600);
			return ytVideoStream;
		}
		console.error("Could  not find a youtube format that works", id);
	} catch (err) {
		console.error("Video not working", id, err);
	}
	return null;
}
const youtubesearchapi = require('youtube-search-api');

export const searchYoutube = (q: string): Promise<YoutubeSearchResult> => {
	const result = youtubesearchapi.GetListByKeyword(q, false, 100);
	return result;
}


// const cookie = 'VISITOR_INFO1_LIVE=OSfRzDMXPQc; _ga=GA1.2.2026872400.1640644751; __Secure-1PSIDCC=AJi4QfHcEd1aefCnNtPWOs0o9A1EHpp7jlGIpOfVzSawcofcUYl40dveUcgysmK1iKPsz8uRlg; PREF=f4=4000000&tz=America.New_York&f6=40000000&f5=30000; wide=1; YSC=3cAuJjh1RGc; SID=JAiSpG1enuJonWcz7pXkN758KT83VNLuZXFq1Lnv1Utva5G-9K00-5D_RZrB74QsERPX8A.; __Secure-1PSID=JAiSpG1enuJonWcz7pXkN758KT83VNLuZXFq1Lnv1Utva5G-5BnrZ4MhikGUgjvkYXTwig.; __Secure-3PSID=JAiSpG1enuJonWcz7pXkN758KT83VNLuZXFq1Lnv1Utva5G-kd9ADT-QO7gpH43wdkf3Pg.; HSID=ArxrWUp3MHAAEbGSX; SSID=AuN-iiAj4KSRq2mhz; APISID=QCevaex0MS7sN-HU/AcJ36v2oNuFOQiBXF; SAPISID=mPPZaFVIdhbq71WY/Av-HPELxuSzskehQs; __Secure-1PAPISID=mPPZaFVIdhbq71WY/Av-HPELxuSzskehQs; __Secure-3PAPISID=mPPZaFVIdhbq71WY/Av-HPELxuSzskehQs; LOGIN_INFO=AFmmF2swRAIgIBzMQT3BXr0YBSRfO-nj2upURfZ3SLCf-DAcCIjz7FMCIHEHQA7AwKrK1VCxxyS-YG8IaPlhL5lfQIwqypYkqSWd:QUQ3MjNmejFIOGVGcG5vT2o5ZVBFclBqMDZVVzNCUml5NTdSNHZZY3RNUnFSOEs1ZDMtZENxZjM0bk1mbXFiYjM4VDU4U1VxLXBfQ2RaUHhBelZ4d3BGbFQ4WTdnOVBTU0lGS2RXRUFMY1ZRd0didG9zbExqcHNJX1hweDlWZThXeUMwQ2J5QmRaUWtpQzEwUW01YXdQN2t1Mjg5MF9SRWp3; SIDCC=AJi4QfHycZNsAVjJzZrCdeanenafkV6B2ZfvCMMIE5EfDwGMwKysrTPh0mZ1r0P0CtB4-S900w; __Secure-3PSIDCC=AJi4QfHS3JtlJ3dPu2NQCSU4Y-PTVoj6LAlIG19PmDPRYKq2xVTymEHhqbzIVVHGQdwixojePw'
export const getVideoStreamFromSearch = async (search: string, pager?: Pager): Promise<YouTubeVideoStream[]> => {
	const ytResults = await searchYoutube(search);
	// console.log("Horace.2", JSON.stringify(ytResults.items.length, null, 2));
	const vidStreams: YouTubeVideoStream[] = [];
	for(const item of ytResults?.items) {
		const {id, thumbnail, title, length, type } = item;
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

