/*!
 * Copyright (c) Duke's VR Tech. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from "@microsoft/mixed-reality-extension-sdk";
import block from "./utils/block";
import {getVideoStreamFromYT} from "./services/yt-service";
import {DukeAds, MyScreenContext, MyScreenUser} from "./models/base";
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

const getSeekDistance = () => process.env.SEEK_DISTANCE ? parseInt(process.env.SEEK_DISTANCE, 10) : 15;

const getMaxRolloffDistance = () => parseInt(process.env.MAX_ROLLOFF_DISTANCE, 10) || 250;

const getNextAd = (): DukeAds | null => {
	const adRerunTime = (process.env.DUKE_ADS_RERUN_TIME) ? parseInt(process.env.DUKE_ADS_RERUN_TIME, 10) : 20
	const adId = process.env.DUKE_ADS_ID;
	if (adId && process.env.DUKE_ADS_DISABLED?.toLowerCase() !== 'true') {
		return {
			dukeAdsId: adId,
			dukeAdsRerunTime: adRerunTime
		}
	}
	return null
}

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
		// 	console.log("Inspect.message", message, serializedMessage)
		// })
		this.assets = new MRE.AssetContainer(context);
		this.context.onStarted(() => this.started());
		this.context.onStopped(this.stopped);
		this.context.onUserLeft((user) => this.handleUserLeft(user));
		this.context.onUserJoined(async (user) => await this.handleUserJoined(user));
	}

	getDefaultSoundOptions = (): MRE.SetVideoStateOptions => {
		let volume = 0.5;
		if (this.parameterSet['v']) {
			const val = parseInt(this.parameterSet['v'] as string);
			if (!Number.isNaN(val)) {
				volume = val / 100;
			}
		}
		let rolloffStartDistance = 5.0;
		if (this.parameterSet['ro']) {
			const val = parseFloat(this.parameterSet['ro'] as string);
			if (!Number.isNaN(val)) {
				rolloffStartDistance = val;
			}
		}
		return ({
			volume,
			spread: 0.25,
			rolloffStartDistance,
			time: 0,
		})
	}
	get defaultVideoId() {
		return (this.parameterSet['vid'] as string) || process.env.DEFAULT_YT_ID || '9gmykUdtUlo'
	}

	get autoStart() {
		return (this.parameterSet['start'] as string || '').toLowerCase() === 'y'
	}

	doPlayActionHelper = async (user: MyScreenUser, stream: YouTubeVideoStream, resetProgress = true) => {
		if (this.context.state !== 'stopped' && this.mediaInstance) {
			await this.onStop(user)
		}
		this.context.currentVideoStream = stream
		const currentSoundOptions = this.context.soundOptions;
		this.context.soundOptions = this.getDefaultSoundOptions();
		if (currentSoundOptions?.volume) {
			this.context.soundOptions.volume = currentSoundOptions.volume;
		}
		if (currentSoundOptions?.rolloffStartDistance) {
			this.context.soundOptions.rolloffStartDistance = currentSoundOptions.rolloffStartDistance;
		}
		if (resetProgress) {
			this.context.progress = undefined;
		}
		await this.onPlay(user);
	};

	handlePlayButtonClick = async (user: MyScreenUser, stream: YouTubeVideoStream) =>
		this.doPlayActionHelper(user, stream, true)

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
		const {state, soundOptions, currentVideoStream, videoActor, dukeAdslastPlayTimestamp = 0} = this.context;
		const { dukeAdsRerunTime, dukeAdsId } = getNextAd() || {}
		if ((state === 'stopped' || !state) && currentVideoStream?.id) {
			let playId = currentVideoStream?.id;
			let progress = this.context.progress || {
				runningTime: 0,
				startTime: 0,
			}
			if (dukeAdsId && Date.now() - dukeAdslastPlayTimestamp > dukeAdsRerunTime * (1000 * 60) && dukeAdsId) {
				playId = dukeAdsId;
				this.context.dukeAdsPlayActive = true
				this.context.dukeAdsProgress = this.context.dukeAdsProgress || { ...progress }
				progress = {
					runningTime: 0,
					startTime: 0,
				}
			}
			const ytVideo = await getVideoStreamFromYT(playId)
			const playTitle = `${this.context.dukeAdsPlayActive ? 'DUKE ADS: ' : ''}${ytVideo.title}`
			const videoStream = this.assets.createVideoStream(
				`yt-${playId}`,
				{
					uri: ytVideo.uri
				}
			);
			this.context.progress = progress
			this.context.progress.startTime = Date.now() - this.context.progress.runningTime * 1000;
			this.context.soundOptions.time = this.context.progress.runningTime;
			this.context.currentVideoStream = ytVideo;
			this.context.updatePlayerTitle(playTitle);
			this.context.updateRemainingTime(this.getRemainingTime());
			this.mediaInstance = videoActor.startVideoStream(videoStream.id, soundOptions);
			this.mediaVideoStream = videoStream;
			console.log("Playing", playTitle, "space", user.properties['altspacevr-space-id']);
			clearInterval(this.context.currentStreamIntervalInterval);
			this.context.currentStreamIntervalInterval = setInterval( () => {
				const remainingTime = this.getRemainingTime();
				if (remainingTime > 0) {
					if (this.context.progress) {
						this.context.progress.runningTime = this.getRunningTime();
						this.context.updateRemainingTime(remainingTime);
					} else {
						console.log("Detected broken context",
							user.name, "space", user.properties['altspacevr-space-id']);
					}
				} else {
					clearInterval(this.context.currentStreamIntervalInterval);
					let nextStream;
					if (this.context.dukeAdsPlayActive) {
						this.context.dukeAdsPlayActive = false
						this.context.dukeAdslastPlayTimestamp = Date.now()
						this.context.progress = { ...this.context.dukeAdsProgress }
						this.context.dukeAdsProgress = undefined
						this.doPlayActionHelper(user, currentVideoStream, false)
						return
					} else {
						nextStream = this.selectionsController.getNextStream(this.context.currentVideoStream.id)
							|| currentVideoStream;
					}
					this.handlePlayButtonClick(user, nextStream);
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
		if (this.mediaInstance && !this.context.dukeAdsPlayActive) {
			if (state === "playing") {
				clearInterval(this.context.currentStreamIntervalInterval)
				this.mediaInstance.stop();
				this.setControlsDisplayEnabled(true);
				this.context.state = 'stopped';
				// this.assets.
				this.mediaInstance = undefined;
				this.mediaVideoStream?.breakReference(this.context.videoActor);
			}
		}
	};
	onRewind = async (user: MRE.User) => {
		if (this.mediaInstance && this.context.currentVideoStream && !this.context.dukeAdsPlayActive) {
			await this.onStop(user);
			const runningTime = this.getRunningTime() - getSeekDistance();
			this.context.progress.runningTime = runningTime >= 0 ? runningTime : 0;
			await this.onPlay(user);
		}
	};
	onFastForward = async (user: MRE.User) => {
		if (this.mediaInstance
			&& this.context.currentVideoStream
			&& !this.context.dukeAdsPlayActive
			&& this.getRemainingTime() > getSeekDistance()) {
			await this.onStop(user);
			this.context.progress.runningTime += getSeekDistance();
			await this.onPlay(user);
		}
	};
	onOpenMenu = async (user: MRE.User) => {
		if (!this.context.dukeAdsPlayActive) {
			await this.selectionsController.displayMovieSelectionPicker(user, false)
		}
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
		this.context.soundOptions = this.getDefaultSoundOptions();
		this.context.currentVideoStream = {
			id: this.defaultVideoId
		}
		this.context.videoActor = videoActor;
		this.playerControls = new PlayerControls(this.context, this.assets, this);
		this.playerControls.createMediaControls(this.root)
		this.setVolumeLabel()
		this.setRolloffDistanceLabel();
		this.setControlsDisplayEnabled(true);
		this.initialized = true;
		if (this.autoStart && this.context.users.length) {
			this.onPlay(this.context.users[0])
		}
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
		const incr = 0.2;
		if (direction === 'down') {
			soundOptions.rolloffStartDistance = val - incr <= incr ? incr : val - incr;
		} else {
			soundOptions.rolloffStartDistance = val >= getMaxRolloffDistance() ? getMaxRolloffDistance() : val + incr
		}
		this.mediaInstance?.setState({rolloffStartDistance: soundOptions.rolloffStartDistance});
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
			this.context.rolloffDistanceLabel.text.contents = `Rolloff: ${val.toFixed(1)}m`;
		}
	}

	setOnScreenControlsClick = () => {
		this.setControlsDisplayEnabled(this.context.controlsHidden);
	}
}

