import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import {BoxAlignment, TextFontFamily, TextJustify} from '@microsoft/mixed-reality-extension-sdk';
import {secondsToString} from "../utils";
import wordWrap from "word-wrap";
import {MyScreenContext, MyScreenUser} from "../models/base";
import {MediaControlHandler, MediaControlHandlerActions} from "../models/controls";
import {debounce} from "debounce";
import {
	ACTOR_MEDIA_CONTROLS,
	ACTOR_ROLLOFF_ROOT,
	ACTOR_VOLUME_ROOT,
	LABEL_REMAINING_TIME,
	LABEL_SELECTION_TITLE
} from "../constants";

const commonDepth = -0.0015

export class PlayerControls {

	playButtonMesh: MRE.Mesh;
	imageButtonMesh: MRE.Mesh;

	constructor(
		private context: MyScreenContext,
		private assets: MRE.AssetContainer,
		private mediaControlHandler: MediaControlHandler) {
		this.playButtonMesh = assets.createCylinderMesh('arrow', 0.005, 0.08, 'z', 3);
		this.imageButtonMesh = assets.createPlaneMesh(`plane-movie-card-mesh`, 0.075, 0.075);
	}

	getImageButtonMaterial = (id: string, uri: string): MRE.Material => {
		let material = null;
		if (!material) {
			const tex = this.assets.createTexture(`texture-${id}`, {
				uri
			});

			material = this.assets.createMaterial(`material-${id}`, {
				mainTextureId: tex.id,
				emissiveTextureId: tex.id,
				emissiveColor: MRE.Color3.Red(),
				color: MRE.Color3.Red()

			});
		}
		return material;
	}

	getMediaControlButton3(prefix: string, parentActor: MRE.Actor, mesh: MRE.Mesh, mat: MRE.Material) {
		const root = MRE.Actor.Create(this.context, {
			actor: {
				name: `base-button-${prefix}-Root`,
				parentId: parentActor.id,
				appearance: {enabled: true},
				grabbable: true,
			}
		});
		const playButton = MRE.Actor.Create(this.context, {
			actor: {
				name: `mc-playbutton-${prefix}`,
				parentId: root.id,
				appearance: {
					meshId: mesh.id,
					materialId: mat.id,
					enabled: true,
					// enabled: this.groupMask
				},
				collider: {geometry: {shape: MRE.ColliderType.Auto}},
				transform: {
					local: {
						rotation: MRE.Quaternion.FromEulerAngles(-Math.PI * .5, Math.PI * 0, Math.PI * 0),
						position: {z: 0.02}
					}
				}
			}
		});
		return {playButton, root};
	}

	createSelectionTitlePanel(parent: MRE.Actor) {
		const scaleDown = 0.7;
		const label = MRE.Actor.Create(this.context, {
			actor: {
				name: LABEL_SELECTION_TITLE,
				parentId: parent.id,
				transform: {
					local: {
						position: {z: commonDepth, y: -0.3, x: -.48},
						// rotation: {y: 45},
						scale: {x: scaleDown, y: scaleDown, z: scaleDown}
					}
				},
				text: {
					contents: "",
					pixelsPerLine: 8,
					height: 0.0225,
					anchor: MRE.TextAnchorLocation.MiddleLeft,
					justify: TextJustify.Left,
					color: MRE.Color3.DarkGray(),
					font: TextFontFamily.SansSerif,
				}
			}
		});
		return label;
	}

	createRemainingTimePanel(parent: MRE.Actor) {
		const label = MRE.Actor.Create(this.context, {
			actor: {
				name: LABEL_REMAINING_TIME,
				parentId: parent.id,
				transform: {
					local: {
						position: {z: commonDepth, y: -0.325, x: -.48},
					}
				},
				text: {
					contents: "00:00:00",
					pixelsPerLine: 12,
					height: 0.0175,
					anchor: MRE.TextAnchorLocation.MiddleLeft,
					justify: TextJustify.Left,
					color: MRE.Color3.DarkGray(),
					font: TextFontFamily.Monospace,
				}
			}
		});
		return label;
	}

	createMediaControls(parentActor: MRE.Actor) {
		if (!this.context.playerControls) {
			this.context.selectionTitlePanel = this.createSelectionTitlePanel(parentActor);
			this.context.updatePlayerTitle = (title = '') => {
				if (this.context.selectionTitlePanel.text) {
					const displayText =
						title
							// eslint-disable-next-line require-unicode-regexp
							.replace(/[^\x20-\x7E]/g, "")
							.substring(0, 55) + (title.length > 55 ? '...' : '')
					this.context.selectionTitlePanel.text.contents = wordWrap(displayText, {
						width: 60,
						trim: true,
						indent: "",
						cut: false,
					});
				}
			}
			const {volumeDownButton, volumeUpButton, volumeLabel} = this.setupVolumeControls(parentActor);
			this.context.volumeDownButton = volumeUpButton;
			this.context.volumeUpButton = volumeDownButton;
			this.context.volumeLabel = volumeLabel;

			const {rolloffDistanceLabel, rolloffDownButton, rolloffUpButton} = this.setupRolloffControls(parentActor);
			this.context.rolloffDistanceLabel = rolloffDistanceLabel;
			this.context.rolloffUpButton = rolloffUpButton;
			this.context.rolloffDownButton = rolloffDownButton;

			const {onScreenControlsButton} = this.setupOnScreenDisplayToggle(parentActor);
			this.context.onScreenControlsButton = onScreenControlsButton;
			const controlScale = 0.45;
			const controlActor = MRE.Actor.Create(this.context, {
				actor: {
					name: ACTOR_MEDIA_CONTROLS,
					grabbable: true,
					parentId: parentActor?.id,
					transform: {
						local: {
							position: {
								y: -0.29, z: -.0108, x: 0.5,
							},
							scale: {
								x: controlScale, y: controlScale, z: controlScale,
							}
						}
					}
				}
			});
			const lPlayBtnMat = this.getImageButtonMaterial('play', '/images/Play.png');
			const lStopBtnMat = this.getImageButtonMaterial('stop', '/images/Stop.png');
			const lMenuBtnMat = this.getImageButtonMaterial('stop', '/images/Cog.png');
			const lRewindBtnMat = this.getImageButtonMaterial('stop', '/images/Backward-15s.png');
			const lFwdBtnMat = this.getImageButtonMaterial('stop', '/images/Forward-15s.png');

			const {
				playButton: menuButton,
				root: menuRoot
			} = this.getMediaControlButton3("menu-button", controlActor, this.imageButtonMesh, lMenuBtnMat);
			const {
				playButton,
				root: playRoot
			} = this.getMediaControlButton3("play-button", controlActor, this.imageButtonMesh, lPlayBtnMat);
			const {
				playButton: stopButton,
				root: stopRoot
			} = this.getMediaControlButton3("stop-button", controlActor, this.imageButtonMesh, lStopBtnMat);
			const {
				playButton: rewindButton,
				root: rewindRoot
			} = this.getMediaControlButton3("rewind-button", controlActor, this.imageButtonMesh, lRewindBtnMat);
			const {
				playButton: fastFordButton,
				root: fastForRoot
			} = this.getMediaControlButton3("fast-forward-button", controlActor, this.imageButtonMesh, lFwdBtnMat);
			const layout = new MRE.PlanarGridLayout(controlActor, BoxAlignment.BottomLeft);
			this.context.menuButton = menuButton;
			this.context.playButton = playButton;
			this.context.stopButton = stopButton;
			this.context.rewindButton = rewindButton;
			this.context.fastFwdButton = fastFordButton;
			const width = .11;
			let col = 0;
			this.context.remainingTimeLabel = this.createRemainingTimePanel(parentActor);
			this.context.updateRemainingTime = (val: number) => {
				if (this.context.remainingTimeLabel.text) {
					this.context.remainingTimeLabel.text.contents = val > -1 ? secondsToString(val) : '00:00:00'
				}
			}
			layout.addCell({
				row: 0, column: col++, width, height: 0.1, contents: menuRoot,
			})
			layout.addCell({
				row: 0, column: col++, width, height: 0.1, contents: stopRoot
			})
			layout.addCell({
				row: 0, column: col++, width, height: 0.1, contents: playRoot,
			})
			layout.addCell({
				row: 0, column: col++, width, height: 0.1, contents: rewindRoot,
			})
			layout.addCell({
				row: 0, column: col++, width, height: 0.1, contents: fastForRoot
			})
			layout.applyLayout();
			this.context.playerControls = controlActor;
		}
	}

	setupVolumeControls = (parent: MRE.Actor) => {
		const volDownMat = this.getImageButtonMaterial('play', '/images/VolumeDown.png');
		const volUpMat = this.getImageButtonMaterial('stop', '/images/VolumeUp.png');
		const volScale = .6;
		const root = MRE.Actor.Create(this.context, {
			actor: {
				name: ACTOR_VOLUME_ROOT,
				parentId: parent.id,
				appearance: {enabled: true},
				grabbable: true,
				transform: {
					local: {
						position: {z: commonDepth, y: 0.31, x: 0.375},
						scale: {x: volScale, y: volScale, z: volScale}

					}
				}
			}
		});
		const layout = new MRE.PlanarGridLayout(root);
		const cw = 0.065, ch = 0.1;
		const arrowScale = 0.60;
		let volumeLabel: MRE.Actor, volumeUpButton: MRE.Actor, volumeDownButton: MRE.Actor;
		layout.addCell({
			row: 0,
			column: 2,
			width: cw / 4,
			height: ch,
			// alignment: BoxAlignment.MiddleCenter,
			contents: volumeLabel = MRE.Actor.Create(this.context, {
				actor: {
					name: `volume-label`,
					parentId: root.id,
					text: {
						contents: `test`,
						height: 0.0225,
						anchor: MRE.TextAnchorLocation.MiddleLeft,
						justify: MRE.TextJustify.Left,
						color: MRE.Color3.DarkGray(),
					}
				}
			})
		});

		layout.addCell({
			row: 0,
			column: 0,
			width: cw,
			height: ch,
			// alignment: BoxAlignment.MiddleCenter,
			contents: volumeDownButton = MRE.Actor.Create(this.context, {
				actor: {
					name: `volumen-down`,
					parentId: root.id,
					appearance: {
						meshId: this.imageButtonMesh.id,
						materialId: volDownMat.id
					},
					collider: {geometry: {shape: MRE.ColliderType.Auto}},
					transform: {
						local: {
							rotation: MRE.Quaternion.FromEulerAngles(-Math.PI * .5, Math.PI * 0, Math.PI * 0),
							scale: {x: arrowScale, y: arrowScale, z: arrowScale},
						}
					}
				}
			})
		});

		layout.addCell({
			row: 0,
			column: 1,
			width: cw,
			height: ch,
			contents: volumeUpButton = MRE.Actor.Create(this.context, {
				actor: {
					name: `volumen-up`,
					parentId: root.id,
					appearance: {
						meshId: this.imageButtonMesh.id,
						materialId: volUpMat.id
					},
					collider: {geometry: {shape: MRE.ColliderType.Auto}},
					transform: {
						local: {
							rotation: MRE.Quaternion.FromEulerAngles(-Math.PI * .5, Math.PI * 0, Math.PI * 0),
							scale: {x: arrowScale, y: arrowScale, z: arrowScale},
						}
					}
				}
			})
		});
		layout.applyLayout()
		return {volumeUpButton, volumeDownButton, volumeLabel}
	}

	setupOnScreenDisplayToggle = (parent: MRE.Actor) => {
		const onScreenControlMat = this.getImageButtonMaterial('onscreen-controls', '/images/Full-Screen.png');
		const volScale = .6;
		const root = MRE.Actor.Create(this.context, {
			actor: {
				name: `base-onscreen-Root`,
				parentId: parent.id,
				appearance: {enabled: true},
				grabbable: true,
				transform: {
					local: {
						position: {z: commonDepth, y: 0.31, x: 0},
						scale: {x: volScale, y: volScale, z: volScale}

					}
				}
			}
		});
		const layout = new MRE.PlanarGridLayout(root);
		const cw = 0.065, ch = 0.1;
		const arrowScale = 0.60;
		let onScreenControlsButton: MRE.Actor;
		layout.addCell({
			row: 0,
			column: 0,
			width: cw,
			height: ch,
			contents: onScreenControlsButton = MRE.Actor.Create(this.context, {
				actor: {
					name: `volume-down`,
					parentId: root.id,
					appearance: {
						meshId: this.imageButtonMesh.id,
						materialId: onScreenControlMat.id
					},
					collider: {geometry: {shape: MRE.ColliderType.Auto}},
					transform: {
						local: {
							rotation: MRE.Quaternion.FromEulerAngles(-Math.PI * .5, Math.PI * 0, Math.PI * 0),
							scale: {x: arrowScale, y: arrowScale, z: arrowScale},
						}
					}
				}
			})
		});

		layout.applyLayout()
		return {onScreenControlsButton}
	}

	setupRolloffControls = (parent: MRE.Actor) => {
		const rolloffDownMat = this.getImageButtonMaterial('play', '/images/Fast-Backward.png');
		const rolloffUpMat = this.getImageButtonMaterial('stop', '/images/Fast-Forward.png');
		const rolloffScale = .6;
		const root = MRE.Actor.Create(this.context, {
			actor: {
				name: ACTOR_ROLLOFF_ROOT,
				parentId: parent.id,
				appearance: {enabled: true},
				grabbable: true,
				transform: {
					local: {
						position: {z: commonDepth, y: 0.31, x: 0.175},
						scale: {x: rolloffScale, y: rolloffScale, z: rolloffScale}

					}
				}
			}
		});
		const layout = new MRE.PlanarGridLayout(root);
		const cw = 0.065, ch = 0.1;
		const arrowScale = 0.60;
		let rolloffDistanceLabel: MRE.Actor, rolloffUpButton: MRE.Actor, rolloffDownButton: MRE.Actor;
		layout.addCell({
			row: 0,
			column: 2,
			width: cw / 4,
			height: ch,
			contents: rolloffDistanceLabel = MRE.Actor.Create(this.context, {
				actor: {
					name: `volume-label`,
					parentId: root.id,
					text: {
						contents: `test`,
						height: 0.0225,
						anchor: MRE.TextAnchorLocation.MiddleLeft,
						justify: MRE.TextJustify.Left,
						color: MRE.Color3.DarkGray(),
					}
				}
			})
		});

		layout.addCell({
			row: 0,
			column: 0,
			width: cw,
			height: ch,
			contents: rolloffDownButton = MRE.Actor.Create(this.context, {
				actor: {
					name: `volumen-down`,
					parentId: root.id,
					appearance: {
						meshId: this.imageButtonMesh.id,
						materialId: rolloffDownMat.id
					},
					collider: {geometry: {shape: MRE.ColliderType.Auto}},
					transform: {
						local: {
							rotation: MRE.Quaternion.FromEulerAngles(-Math.PI * .5, Math.PI * 0, Math.PI * 0),
							scale: {x: arrowScale, y: arrowScale, z: arrowScale},
						}
					}
				}
			})
		});

		layout.addCell({
			row: 0,
			column: 1,
			width: cw,
			height: ch,
			contents: rolloffUpButton = MRE.Actor.Create(this.context, {
				actor: {
					name: `volume-up`,
					parentId: root.id,
					appearance: {
						meshId: this.imageButtonMesh.id,
						materialId: rolloffUpMat.id
					},
					collider: {geometry: {shape: MRE.ColliderType.Auto}},
					transform: {
						local: {
							rotation: MRE.Quaternion.FromEulerAngles(-Math.PI * .5, Math.PI * 0, Math.PI * 0),
							scale: {x: arrowScale, y: arrowScale, z: arrowScale},
						}
					}
				}
			})
		});
		layout.applyLayout()
		return {rolloffUpButton, rolloffDownButton, rolloffDistanceLabel}
	}

	attachBehaviors() {
		if (
			this.context.playButton &&
			this.context.stopButton &&
			this.context.rewindButton &&
			this.context.fastFwdButton &&
			this.context.menuButton) {
			this.context.playButton.setBehavior(MRE.ButtonBehavior).onClick(this.handlePlayButton)
			// .onHover("enter", () => {
			//     this.playButton.appearance.meshId = this.buttonMaterials.hover.id;
			// })
			// .onHover("exit", () => {
			//     this.playButton.appearance.meshId = this.buttonMaterials.default.id;
			// });
			this.context.stopButton.setBehavior(MRE.ButtonBehavior).onClick(this.handleStopButton);
			this.context.rewindButton.setBehavior(MRE.ButtonBehavior).onClick(this.handleRewindButton);
			this.context.fastFwdButton.setBehavior(MRE.ButtonBehavior).onClick(this.handleFFButton);
			this.context.menuButton.setBehavior(MRE.ButtonBehavior).onClick(this.handleMenuButton);
		}
		if (this.context.volumeDownButton && this.context.volumeUpButton) {
			this.context.volumeDownButton.setBehavior(MRE.ButtonBehavior)
				.onHover('hovering', debounce(this.handleVolumeChange("down"), 125))
			this.context.volumeUpButton.setBehavior(MRE.ButtonBehavior)
				.onHover('hovering', debounce(this.handleVolumeChange("up"), 125))
		}
		if (this.context.rolloffDownButton && this.context.rolloffUpButton) {
			this.context.rolloffDownButton.setBehavior(MRE.ButtonBehavior)
				.onHover('hovering', debounce(this.handleRolloffDistanceChange("down"), 125))
			this.context.rolloffUpButton.setBehavior(MRE.ButtonBehavior)
				.onHover('hovering', debounce(this.handleRolloffDistanceChange("up"), 125))
		}
		if (this.context.onScreenControlsButton) {
			this.context.onScreenControlsButton.setBehavior(MRE.ButtonBehavior)
				.onClick(this.mediaControlHandler.setOnScreenControlsClick)
		}
	}

	handleButtonAction = async (user1: MyScreenUser, action: MediaControlHandlerActions) => {
		if (!this.context.ignoreClicks) {
			try {
				this.context.ignoreClicks = true;
				await this.mediaControlHandler?.[action](user1);
			} finally {
				this.context.ignoreClicks = false;
			}
		}
	}
	handlePlayButton = async (user1: MyScreenUser) => this.handleButtonAction(user1, 'onPlay');
	handleStopButton = async (user1: MyScreenUser) => this.handleButtonAction(user1, 'onStop');
	handleRewindButton = async (user1: MyScreenUser) => this.handleButtonAction(user1, 'onRewind');
	handleFFButton = async (user1: MyScreenUser) => this.handleButtonAction(user1, 'onFastForward');
	handleMenuButton = async (user1: MyScreenUser) => this.handleButtonAction(user1, 'onOpenMenu');
	handleVolumeChange = (dir: 'up' | 'down') => (user1: MyScreenUser) => {
		if (!this.context.ignoreClicks) {
			try {
				this.context.ignoreClicks = true;
				this.mediaControlHandler.onVolumeChange(dir);
			} finally {
				this.context.ignoreClicks = false
			}
		}
	}
	handleRolloffDistanceChange = (dir: 'up' | 'down') => (user1: MyScreenUser) => {
		if (!this.context.ignoreClicks) {
			try {
				this.context.ignoreClicks = true;
				this.mediaControlHandler.onRolloffDistanceChange(dir);
			} finally {
				this.context.ignoreClicks = false
			}
		}
	}
}
