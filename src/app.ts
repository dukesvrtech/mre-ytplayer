/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from "@microsoft/mixed-reality-extension-sdk";
import debounce from "lodash.debounce";
import block from "./block";
import {ParameterSet} from "@microsoft/mixed-reality-extension-sdk";
import {getVideoStreamFromYT} from "./services/yt-service";
import {MyScreenContext, MyScreenUser} from "./models/base";
import {MediaControlHandler} from "./models/controls";
import {PlayerControls} from "./actors/player-controls";
import {hmsToSecondsOnly} from "./utils";
import {YoutubeSelectionsController} from "./actors/youtube-selections-controller";
import { YouTubeVideoStream } from "./models/yt";

const getDefaultSoundOptions = (): MRE.SetVideoStateOptions => ({
	volume: 0.45,
	spread: 0.0,
	rolloffStartDistance: 50,
})
/**
 * The main class of this Index. All the logic goes here.
 */
export default class App implements MediaControlHandler {
	private assets: MRE.AssetContainer;
	private initialized = false;
	private root: MRE.Actor;
	private mediaInstance: MRE.MediaInstance;
	private mediaVideoStream: MRE.VideoStream;
	private playerControls: PlayerControls;
	private selectionsController: YoutubeSelectionsController;

	constructor(private context: MyScreenContext, private parameterSet: MRE.ParameterSet) {
		console.log(this.context.sessionId, "constructed");
		this.context.conn.on('send', (message, serializedMessage) => {
			console.log("Horace.message", message, serializedMessage)
		})
		this.assets = new MRE.AssetContainer(context);
		this.context.onStarted(() => this.started(parameterSet));
		this.context.onStopped(this.stopped);
		this.context.onUserLeft((user) => this.handleUserLeft(user));
		this.context.onUserJoined(async (user) => await this.handleUserJoined(user));
	}

	handlePlayButtonClick = async (user: MyScreenUser, stream: YouTubeVideoStream) => {
		if (this.context.state !== 'stopped' && this.mediaInstance) {
			await this.onStop(user, true)
		}
		this.context.currentVideoStream = stream
		await this.onPlay(user);
	};

	onPlay = async (user: MRE.User) => {
		const { state, soundOptions, currentVideoStream, videoActor } = this.context;
		if ((state === 'stopped' || !state) && currentVideoStream?.id) {
			const ytVideo = await getVideoStreamFromYT(currentVideoStream?.id)
			const videoStream = this.assets.createVideoStream(
				`yt-${currentVideoStream.id}`,
				{
					uri: ytVideo.uri
				}
			);
			this.context.currentVideoStream = ytVideo;
			this.context.updatePlayerTitle(ytVideo.title);
			this.context.updateRemainingTime(hmsToSecondsOnly(ytVideo.duration))
			this.mediaInstance = videoActor.startVideoStream(videoStream.id, soundOptions)
			this.mediaVideoStream = videoStream;
		} else if (state === "paused") {
			this.mediaInstance.resume();
		}
		this.context.state = "playing";
	};

    onStop = async (user: MRE.User, forced = false) => {
		const { state, soundOptions, currentVideoStream, videoActor } = this.context;
		if (this.mediaInstance) {
			if (state === "playing") {
				this.mediaInstance.stop();
				this.context.state = 'stopped'
				// this.assets.
				this.mediaInstance = undefined;
				this,this.mediaVideoStream?.breakReference(this.context.videoActor)
			}
		// 	else if (state === 'playing') {
		// 		this.mediaInstance.pause();
		// 		console.log("Horace", "Pause");
		// 		this.context.state = 'paused'
		// 	}
		}

	};
    onRewind: (user: MRE.User) => Promise<void>;
    onFastForward: (user: MRE.User) => Promise<void>;
    onOpenMenu = async (user: MRE.User) => {
		await this.selectionsController.displayMovieSelectionPicker(user, false)
	};
	onCloseMenu(user: MyScreenUser): Promise<void> {
		return Promise.resolve(undefined);
	}

	private handleUserJoined = async (user: MyScreenUser) => {
		if (!this.initialized) {
			await block(() => this.initialized, 15000);
		}
		this.attachBehaviors();
	}
	private debounceClick = (callbackFn: any) => debounce(callbackFn, 1000, {
		leading: true, trailing: false
	});
	private attachBehaviors = () => {
		this.playerControls?.attachBehaviors();
		this.selectionsController?.attachBehaviors();
	}
	private isUserElevated(user: MyScreenUser) {
		console.log(user.properties['altspacevr-roles']);
		const terraformer = (user.properties['altspacevr-roles'].includes('terraformer'));
		const host = (user.properties['altspacevr-roles'].includes('host'));
		const moderator = (user.properties['altspacevr-roles'].includes('moderator'));
		return moderator || host || terraformer;
	}
	private handleUserLeft = (user: MyScreenUser) => {
	};

	private started = async (params: ParameterSet) => {
		console.log(this.context.sessionId, "App Started", params);
		this.root = MRE.Actor.Create(this.context, {
			actor: {
				name: `yt-bigscreen-Root`,
				transform: {
					local: {
						// scale: {x: scaleFactor, y: scaleFactor, z: scaleFactor}
					}
				}
			}
		});
		this.selectionsController = new YoutubeSelectionsController(this.context, this);
		const videoActor = MRE.Actor.Create(this.context, {
			actor: {
				// appearance: { enabled: groupMask },
				parentId: this.root.id,
				name: `big-screen-video`,
				// light: { type: 'point', intensity: 2.5, range: 50, enabled: true, spotAngle: 180, color: MRE.Color3.White() }, // Add a light component.
				// rigidBody: this.attach ? { isKinematic: true } : undefined,
				// collider: this.attach ? {bounciness: 10, geometry: {shape: ColliderType.Auto}} : undefined,
			}
		});
		await this.root.created();
		// Initial for testing
		this.context.soundOptions = getDefaultSoundOptions();
		this.context.currentVideoStream = {
			id: '9gmykUdtUlo',
		}
		// const vId = '9gmykUdtUlo';
		// const ytVideo = await getVideoStreamFromYT(vId)
		// const videoStream = this.assets.createVideoStream(
		// 	`yt-${vId}`,
		// 	{
		// 		uri: ytVideo.uri
		// 	}
		// );

		// const videoStream = this.assets.createVideoStream(
		// 	'live', { uri: 'http://home.dukesvr.tech:8080/hls/stream/index.m3u8' }
		// )
		// const soundOptions = getDefaultSoundOptions();
		// this.mediaInstance = videoActor.startVideoStream(videoStream.id, soundOptions)
		this.context.videoActor = videoActor;
		this.playerControls = new PlayerControls(this.context, this.assets, this);
		this.playerControls.createUserControls(this.root)

		this.initialized = true;
	};

	private stopped = () => {
		console.log(this.context.sessionId, "App Stopped");
	};
}
