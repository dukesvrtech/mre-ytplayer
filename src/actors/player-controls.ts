import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import {BoxAlignment, TextFontFamily, TextJustify} from '@microsoft/mixed-reality-extension-sdk';
import {secondsToString} from "../utils";
import wordWrap from "word-wrap";
import {MyScreenContext, MyScreenUser} from "../models/base";
import {MediaControlHandler, MediaControlHandlerActions} from "../models/controls";
import {YouTubeVideoStream} from "../models/yt";

export class PlayerControls {

    playButtonMesh: MRE.Mesh;
	imageButtonMesh: MRE.Mesh;

	// buttonMaterials: {
    //     hover: MRE.Material;
    //     default: MRE.Material;
    //     active: MRE.Material;
    // }
    // stopButtonMesh: MRE.Mesh;

    constructor(private context: MyScreenContext, private assets: MRE.AssetContainer, private mediaControlHandler: MediaControlHandler) {
    	this.playButtonMesh = assets.createCylinderMesh('arrow', 0.005, 0.08, 'z', 3);
		this.imageButtonMesh = assets.createPlaneMesh(`plane-movie-card-mesh`, 0.075, 0.075);
    	const material = assets.createMaterial("mat", {color: MRE.Color3.Red()});
    	// this.stopButtonMesh = assets.createBoxMesh("box", 0.12, 0.12, 0.005);
    	// this.buttonMaterials = {
    	// 	hover: assets.createMaterial("mat", {color: MRE.Color3.Red()}),
    	// 	default: material,
    	// 	active: material,
    	// }
    }

	getImageButtonMaterial = (id: string, uri: string): MRE.Material => {
		let material = null; // TODO: this.movieCardMaterials[syncVideoStream.id];
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

    getMediaControlButton2(prefix: string, parentActor: MRE.Actor, mesh: MRE.Mesh, mat: MRE.Material) {
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
						rotation: MRE.Quaternion.FromEulerAngles(0, 0, Math.PI * 0.5),
						position: {z: 0.02}
					}
				}
			}
		});

		// const playButton = MRE.Actor.Create(this.context, {
    	// 	actor: {
    	// 		name: `mc-playbutton-${prefix}`,
    	// 		parentId: root.id,
    	// 		appearance: {
    	// 			meshId: mesh.id,
    	// 			materialId: mat.id,
    	// 			enabled: true,
    	// 			// enabled: this.groupMask
    	// 		},
    	// 		collider: {geometry: {shape: MRE.ColliderType.Auto}},
    	// 		transform: {
    	// 			local: {
    	// 				rotation: MRE.Quaternion.FromEulerAngles(0, 0, Math.PI * 0.5),
    	// 				position: {z: 0.02}
    	// 			}
    	// 		}
    	// 	}
    	// });
    	return {playButton, root};
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

		// const playButton = MRE.Actor.Create(this.context, {
		// 	actor: {
		// 		name: `mc-playbutton-${prefix}`,
		// 		parentId: root.id,
		// 		appearance: {
		// 			meshId: mesh.id,
		// 			materialId: mat.id,
		// 			enabled: true,
		// 			// enabled: this.groupMask
		// 		},
		// 		collider: {geometry: {shape: MRE.ColliderType.Auto}},
		// 		transform: {
		// 			local: {
		// 				rotation: MRE.Quaternion.FromEulerAngles(0, 0, Math.PI * 0.5),
		// 				position: {z: 0.02}
		// 			}
		// 		}
		// 	}
		// });
		return {playButton, root};
	}

    createSelectionTitlePanel(parent: MRE.Actor) {
    	const scaleDown = 0.7;
    	const label = MRE.Actor.Create(this.context, {
    		actor: {
    			name: `user-current-selection-title`,
    			parentId: parent.id,
    			transform: {
    				local: {
    					position: {z: -.00265, y: -0.3, x: -.48},
    					// rotation: {y: 45},
    					scale: {x: scaleDown, y: scaleDown, z: scaleDown}
    				}
    			},
    			text: {
    				contents: "",
    				pixelsPerLine:8,
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
    			name: `remaing-time`,
    			parentId: parent.id,
    			transform: {
    				local: {
    					position: {z: -.00265, y: -0.325, x: -.48},
    					// position: {z: -2.17, y: -10.4, x: timeModeLeft},
    					// rotation: {y: 45},
    					// scale: {x: 20.0, y: 20.0, z: 20.0}
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

    createUserControls(parentActor: MRE.Actor) {
    	if (!this.context.playerControls) {
    		this.context.selectionTitlePanel = this.createSelectionTitlePanel(parentActor);
    		this.context.updatePlayerTitle = (title = '') => {
    			if (this.context.selectionTitlePanel.text) {
    				// title = "123456789 123456789 123456789 123456789  123456789  123456789  123456789   123456789   123456789   123456789 "
    				const displayText =
                        title
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
    		const controlScale = 0.45;
    		const controlActor = MRE.Actor.Create(this.context, {
    			actor: {
    				name: `media-controls-wrapper`,
    				grabbable: true,
    				parentId: parentActor?.id, // TODO: Play Actor
    				transform: {
    					local: {
    						position: {
    							y: -0.29, z: -.01250, x: 0.5,
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

			// const lPlyBtnMesh = this.imageButtonMesh;

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

    attachBehaviors() {
    	if (this.context.playButton && this.context.stopButton && this.context.rewindButton && this.context.fastFwdButton && this.context.menuButton) {
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
    }
	handleButtonAction = async (user1: MyScreenUser, action: MediaControlHandlerActions) => {
		if (!this.context.ignoreClicks) {
			try {
				this.context.ignoreClicks = true;
				this.mediaControlHandler?.[action](user1);
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

}
