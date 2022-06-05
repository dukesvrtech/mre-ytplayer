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
import {
	ACTOR_MEDIA_CONTROLS,
	ACTOR_ROLLOFF_ROOT,
	ACTOR_VOLUME_ROOT,
	LABEL_REMAINING_TIME,
	LABEL_SELECTION_TITLE
} from "./constants";

const getDefaultSoundOptions = (): MRE.SetVideoStateOptions => ({
	volume: 0.5,
	spread: 0.0,
	rolloffStartDistance: 10,
	time: 0,
})

const getSeekDistance = () => process.env.SEEK_DISTANCE ? parseInt(process.env.SEEK_DISTANCE, 10) : 15;

const getMaxRolloffDistance = () => parseInt(process.env.MAX_ROLLOFF_DISTANCE, 10) || 250;

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
		if (currentSoundOptions?.rolloffStartDistance) {
			this.context.soundOptions.rolloffStartDistance = currentSoundOptions.rolloffStartDistance;
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
			console.log("Playing", ytVideo.title, "space", user.properties['altspacevr-space-id']);
			clearInterval(this.context.currentStreamIntervalInterval);
			let counter = 0;
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
				counter++;
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
				this.setControlsDisplayEnabled(true);
				this.context.state = 'stopped';
				// this.assets.
				this.mediaInstance = undefined;
				this.mediaVideoStream?.breakReference(this.context.videoActor);
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
		console.log("User Joined", user.name, "space", user.properties['altspacevr-space-id']);
	}
	private attachBehaviors = () => {
		this.playerControls?.attachBehaviors();
		this.selectionsController?.attachBehaviors();
	}
	private handleUserLeft = (user: MyScreenUser) => {
		console.log("User Left", user.name, "space", user.properties['altspacevr-space-id']);
	};

	private started = async () => {
		console.log(this.context.sessionId, "App Started", this.parameterSet);
		this.backgroundMesh = this.assets.createBoxMesh("main-background", 1, 0.68, 0.000005);
		// this.backgroundMaterial = this.assets.createMaterial("main-material", {color: MRE.Color3.Black()});
		const tex = this.assets.createTexture(`texture-background`, {
			uri: '/images/yt-background.png',
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
		this.playerControls.createMediaControls(this.root)
		this.setVolumeLabel()
		this.setRolloffDistanceLabel();
		this.setControlsDisplayEnabled(true);
		this.initialized = true;
	};
	
	setControlsDisplayEnabled = (enabled: boolean) => {
		const actors = [
			LABEL_SELECTION_TITLE,
			LABEL_REMAINING_TIME,
			ACTOR_MEDIA_CONTROLS,
			ACTOR_VOLUME_ROOT,
			ACTOR_ROLLOFF_ROOT
		];
		for(const actor of actors) {
			const anActor = this.root.findChildrenByName(actor, false)?.[0];
			if (anActor) {
				anActor.appearance.enabled = enabled;
			}
		}
		this.context.controlsHidden = !enabled;
	}

	private stopped = () => {
		clearInterval(this.context.currentStreamIntervalInterval);
		this.selectionsController?.destroyAssets();
		this.mediaVideoStream?.breakAllReferences();
		this.assets.unload();
		this.context?.ytSelectionPanel?.destroy();
		this.root?.destroy();
		this.playerControls = undefined;
		this.root = undefined;
		this.mediaInstance = undefined;
		this.mediaVideoStream = undefined;
		this.selectionsController = undefined;
		this.assets = undefined;
		this.backgroundMesh = undefined;
		this.backgroundMaterial = undefined;

		delete this.context.videoActor;
		delete this.context.playerControls;
		delete this.context.selectionTitlePanel;
		delete this.context.updatePlayerTitle;
		delete this.context.rewindButton;
		delete this.context.fastFwdButton;
		delete this.context.volumeUpButton;
		delete this.context.volumeDownButton;
		delete this.context.volumeLabel;
		delete this.context.rolloffDistanceLabel;
		delete this.context.remainingTimeLabel;
		delete this.context.updateRemainingTime;
		delete this.context.currentVideoStream;
		delete this.context.soundOptions;
		delete this.context.ytSelectionPanel;
		delete this.context.ytSelectionsPager;
		delete this.context.pagerButtons;
		delete this.context.ytPagerButtons;
		delete this.context.progress;
		delete this.context.currentStreamIntervalInterval;
		delete this.context.onScreenControlsButton;
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
	onRolloffDistanceChange = (direction: "up" | "down") => {
		const soundOptions = this.context.soundOptions
		const val = soundOptions.rolloffStartDistance;
		if (direction === 'down') {
			soundOptions.rolloffStartDistance = val <= 1 ? 1 : val - 1;
		} else {
			soundOptions.rolloffStartDistance = val >= getMaxRolloffDistance() ? getMaxRolloffDistance() : val + 1
		}
		this.mediaInstance?.setState({rolloffStartDistance: soundOptions.volume});
		this.context.soundOptions = soundOptions;
		this.setRolloffDistanceLabel();
	}
	setVolumeLabel = () => {
		if (this.context.soundOptions && this.context.volumeLabel) {
			const val = this.context.soundOptions.volume * 100;
			this.context.volumeLabel.text.contents = `Vol: ${Math.round(val)}%`;
		}
	}
	setRolloffDistanceLabel = () => {
		if (this.context.soundOptions && this.context.rolloffDistanceLabel) {
			const val = this.context.soundOptions.rolloffStartDistance;
			this.context.rolloffDistanceLabel.text.contents = `Rolloff: ${Math.round(val)}m`;
		}
	}

	setOnScreenControlsClick = () => {
		this.setControlsDisplayEnabled(this.context.controlsHidden);
	}
}

