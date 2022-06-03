/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from "@microsoft/mixed-reality-extension-sdk";
import block from "./block";
import {getVideoStreamFromYT} from "./services/yt-service";
import {MyScreenContext, MyScreenUser} from "./models/base";
import {MediaControlHandler} from "./models/controls";
import {PlayerControls} from "./actors/player-controls";
import {hmsToSecondsOnly} from "./utils";
import {YoutubeSelectionsController} from "./actors/youtube-selections-controller";
import { YouTubeVideoStream } from "./models/yt";
import * as process from "process";

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
		this.context.onStarted(() => this.started());
		this.context.onStopped(this.stopped);
		this.context.onUserLeft((user) => this.handleUserLeft(user));
		this.context.onUserJoined(async (user) => await this.handleUserJoined(user));
	}

	handlePlayButtonClick = async (user: MyScreenUser, stream: YouTubeVideoStream) => {
		if (this.context.state !== 'stopped' && this.mediaInstance) {
			await this.onStop(user)
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

    onStop = async (user: MRE.User) => {
    	const { state } = this.context;
    	if (this.mediaInstance) {
    		if (state === "playing") {
    			this.mediaInstance.stop();
    			this.context.state = 'stopped';
    			// this.assets.
    			this.mediaInstance = undefined;
				this.mediaVideoStream?.breakReference(this.context.videoActor)
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
	private attachBehaviors = () => {
		this.playerControls?.attachBehaviors();
		this.selectionsController?.attachBehaviors();
	}
	private handleUserLeft = (user: MyScreenUser) => {
	};

	private started = async () => {
		console.log(this.context.sessionId, "App Started",this.parameterSet);
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
				parentId: this.root.id,
				name: `big-screen-video`,
			}
		});
		await this.root.created();
		// Initial for testing
		this.context.soundOptions = getDefaultSoundOptions();
		this.context.currentVideoStream = {
			id: process.env.DEFAULT_YT_ID || '9gmykUdtUlo' // TODO:
		}
		this.context.videoActor = videoActor;
		this.playerControls = new PlayerControls(this.context, this.assets, this);
		this.playerControls.createUserControls(this.root)

		this.initialized = true;
	};

	private stopped = () => {
		console.log(this.context.sessionId, "App Stopped");
	};
}
