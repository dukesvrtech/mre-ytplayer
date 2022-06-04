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
import {YouTubeVideoStream} from "./models/yt";
import * as process from "process";

const getDefaultSoundOptions = (): MRE.SetVideoStateOptions => ({
	volume: 0.5,
	spread: 0.0,
	rolloffStartDistance: 50,
	time: 0,
})

const getSeekDistance = () => process.env.SEEK_DISTANCE ? parseInt(process.env.SEEK_DISTANCE, 10) : 15;
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
	private backgroundMesh: MRE.Mesh;
	private backgroundMaterial: MRE.Material;

	constructor(private context: MyScreenContext, private parameterSet: MRE.ParameterSet) {
		console.log(this.context.sessionId, "constructed");
		// this.context.conn.on('send', (message, serializedMessage) => {
		// 	console.log("Horace.message", message, serializedMessage)
		// })
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
		const currentSoundOptions = this.context.soundOptions;
		this.context.soundOptions = getDefaultSoundOptions();
		if (currentSoundOptions?.volume) {
			this.context.soundOptions.volume = currentSoundOptions.volume;
		}
		this.context.progress = undefined;
		await this.onPlay(user);
	};
	getRunningTime = () => {
		if (this.context.progress) {
			const delta = Date.now() - this.context.progress.startTime;
			return Math.round(delta >= 0 ? delta : 0) / 1000;
		}
		return 0;
	}
	getRemainingTime = () => {
		if (this.context.currentVideoStream) {
			const runningTime = this.getRunningTime();
			return hmsToSecondsOnly(this.context.currentVideoStream.duration) - runningTime;
		}
		return 0;
	}

	onPlay = async (user: MRE.User) => {
		const {state, soundOptions, currentVideoStream, videoActor} = this.context;
		if ((state === 'stopped' || !state) && currentVideoStream?.id) {
			const ytVideo = await getVideoStreamFromYT(currentVideoStream?.id)
			const videoStream = this.assets.createVideoStream(
				`yt-${currentVideoStream.id}`,
				{
					uri: ytVideo.uri
				}
			);
			this.context.progress = this.context.progress || {
				runningTime: 0,
				startTime: 0,
			}
			this.context.progress.startTime = Date.now() - this.context.progress.runningTime * 1000;
			this.context.soundOptions.time = this.context.progress.runningTime;
			this.context.currentVideoStream = ytVideo;
			this.context.updatePlayerTitle(ytVideo.title);
			this.context.updateRemainingTime(this.getRemainingTime())
			this.mediaInstance = videoActor.startVideoStream(videoStream.id, soundOptions)
			this.mediaVideoStream = videoStream;
			clearInterval(this.context.currentStreamIntervalInterval);
			this.context.currentStreamIntervalInterval = setInterval(() => {
				const remainingTime = this.getRemainingTime();
				if (remainingTime > 0) {
					this.context.progress.runningTime = this.getRunningTime();
					this.context.updateRemainingTime(remainingTime);
				} else {
					clearInterval(this.context.currentStreamIntervalInterval);
					const nextStream = this.selectionsController.getNextStream(this.context.currentVideoStream.id);
					if (nextStream) {
						this.handlePlayButtonClick(user, nextStream)
					}
				}
			}, 5000);

		} else if (state === "paused") {
			this.mediaInstance.resume();
		}
		this.context.state = "playing";
	};

	// eslint-disable-next-line @typescript-eslint/require-await
	onStop = async (user: MRE.User) => {
		const {state} = this.context;
		if (this.mediaInstance) {
			if (state === "playing") {
				clearInterval(this.context.currentStreamIntervalInterval)
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
	onRewind = async (user: MRE.User) => {
		if (this.mediaInstance && this.context.currentVideoStream) {
			await this.onStop(user);
			const runningTime = this.getRunningTime() - getSeekDistance();
			this.context.progress.runningTime = runningTime >= 0 ? runningTime : 0;
			await this.onPlay(user);
		}
	};
	onFastForward = async (user: MRE.User) => {
		if (this.mediaInstance && this.context.currentVideoStream && this.getRemainingTime() > getSeekDistance()) {
			await this.onStop(user);
			this.context.progress.runningTime += getSeekDistance();
			await this.onPlay(user);
		}
	};
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
		console.log(this.context.sessionId, "App Started", this.parameterSet);
		this.backgroundMesh = this.assets.createBoxMesh("main-background", 1, 0.68, 0.005);
		// this.backgroundMaterial = this.assets.createMaterial("main-material", {color: MRE.Color3.Black()});
		const tex = this.assets.createTexture(`texture-background`, {
			uri: '/images/yt-background.png'
		});

		this.backgroundMaterial = this.assets.createMaterial(`main-material`, {
			mainTextureId: tex.id,
			emissiveTextureId: tex.id,
			emissiveColor: MRE.Color3.White(),
			// color: MRE.Color3.Red()

		});

		this.root = MRE.Actor.Create(this.context, {
			actor: {
				name: `yt-Root`,
				appearance: {
					materialId: this.backgroundMaterial.id,
					meshId: this.backgroundMesh.id
				},
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
				transform: {
					local: {
						position: {z: -0.00325}
					}
				}
			}
		});
		await this.root.created();
		// Initial for testing
		this.context.soundOptions = getDefaultSoundOptions();
		this.context.currentVideoStream = {
			id: process.env.DEFAULT_YT_ID || '9gmykUdtUlo'
		}
		this.context.videoActor = videoActor;
		this.playerControls = new PlayerControls(this.context, this.assets, this);
		this.playerControls.createUserControls(this.root)
		this.setVolumeLabel()
		this.initialized = true;
	};

	private stopped = () => {
		this.selectionsController?.destroyAssets();
		this.mediaVideoStream.breakAllReferences();
		this.assets.unload();
		this.context?.ytSelectionPanel?.destroy();
		this.root?.destroy();
		console.log(this.context.sessionId, "App Stopped");
	};

	onVolumeChange = (direction: "up" | "down") => {
		const soundOptions = this.context.soundOptions
		const vol = Math.round(soundOptions.volume * 100) / 100;
		if (direction === 'down') {
			soundOptions.volume = vol >= 1.0 ? 1.0 : vol + (vol < .1 ? .02 : .1);
		} else {
			soundOptions.volume = vol <= 0.0 ? 0.0 : vol - (vol <= .1 ? .02 : .1);
		}
		this.mediaInstance?.setState({volume: soundOptions.volume});
		this.context.soundOptions = soundOptions;
		this.setVolumeLabel();
	}
	setVolumeLabel = () => {
		if (this.context.soundOptions && this.context.volumeLabel) {
			const val = this.context.soundOptions.volume * 100;
			this.context.volumeLabel.text.contents = `Vol: ${Math.round(val)}%`;
		}
	}
}

