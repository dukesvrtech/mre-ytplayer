import * as MRE from "@microsoft/mixed-reality-extension-sdk";
import url from 'url';
import {AlphaMode, AssetContainer, BoxAlignment, TextFontFamily} from "@microsoft/mixed-reality-extension-sdk";
import wordWrap from "word-wrap";
import {YouTubeVideoStream} from "../models/yt";
import {MyScreenContext, MyScreenUser} from "../models/base";
import {MediaControlHandler} from "../models/controls";
import {getVideoStreamFromSearch} from "../services/yt-service";

const pageSize = 18;
const chooserScale = 0.95;
export const playButtonName = "playButton";
export const playButtonLabel = "label";

type MyScreenPlayButton = MRE.Actor & { selectedStream: YouTubeVideoStream };
export class YoutubeSelectionsController {
    private movieCardMesh: MRE.Mesh;
    private playButtonMaterial: MRE.Material;
    private playButtonMesh: MRE.Mesh;
    private backButtonMesh: MRE.Mesh;
    private backButtonMaterial: MRE.Material;
    private currentPlayMaterial: MRE.Material;
    private previousSearch = "";
    private controlActor: MRE.Actor;
    private assets: MRE.AssetContainer;
    private baseAssets: MRE.AssetContainer;

    // private movieCardMaterials: Record<string, MRE.Material> = {};
    private displayCardsBase: MRE.Actor;
    private nextStreamMapping: Record<string, YouTubeVideoStream> = {};
    // private cardsBaseCache: Record<string, MRE.Actor> = {}
	private imageButtonMesh: MRE.Mesh;

    constructor(
        private context: MyScreenContext,
        private mediaControlHandler: MediaControlHandler
    ) {
    	this.setupAssets();
    	this.setup()
    }

    clearDisplayedBase = () => {
    	if (this.baseAssets) {
    		try {
    			this.baseAssets.unload();
    		} catch (err) { }
    		this.baseAssets = new MRE.AssetContainer(this.context); // Let's clean uup the assets
            this.displayCardsBase?.destroy();
            this.displayCardsBase = undefined;
    	}
    }

    getMovieCardMaterial = (syncVideoStream: YouTubeVideoStream): MRE.Material => {
    	let material = null; // TODO: this.movieCardMaterials[syncVideoStream.id];
    	if (!material) {
    		const tex = this.baseAssets.createTexture(`texture-${syncVideoStream.id}`, {
    			uri: syncVideoStream.photoUrl
    		});

    		material = this.baseAssets.createMaterial(`material-${syncVideoStream.id}`, {
    			mainTextureId: tex.id,
    			emissiveTextureId: tex.id,
    			emissiveColor: MRE.Color3.White(),

    		});
    		// this.movieCardMaterials[syncVideoStream.id] = material
    	}
    	return material;
    }

    setupAssets() {
    	this.assets = new MRE.AssetContainer(this.context);
    	this.baseAssets = new MRE.AssetContainer(this.context);
    	this.movieCardMesh = this.assets.createPlaneMesh(`plane-movie-card-mesh`, 1.5, 1.0);
    	this.playButtonMaterial = this.assets.createMaterial("playButtonMat", {
    		color: MRE.Color3.Red(),
    		emissiveColor: MRE.Color3.Red(),
    	});
    	this.playButtonMesh = this.assets.createBoxMesh("playButtonMesh", 0.03, 0.0125, 0.0005);

    	this.backButtonMesh = this.assets.createBoxMesh("backButtonMesh", 0.12, 0.12, 0.005);
    	this.backButtonMaterial =
            this.assets.createMaterial("backButtonMaterial", {
            	// color: MRE.Color3.Black()
            	color: MRE.Color4.FromColor3(MRE.Color3.Black(), 0),
            	alphaMode: AlphaMode.Blend,
            });
    	this.currentPlayMaterial = this.assets.createMaterial("currentButtonMat", {color: MRE.Color3.Green()});
    }

    destroyAssets() {
    	try {
            this.assets?.unload();
    	} catch (err) { }
    	try {
    		this.baseAssets.unload();
    	} catch (err) { }
    	delete this.currentPlayMaterial;
    	if (this.displayCardsBase) {
    		this.displayCardsBase.appearance.enabled = false;
            this.displayCardsBase?.destroy();
            this.displayCardsBase = undefined;
    	}
    	if (this.controlActor) {
    		this.controlActor.appearance.enabled = false;
    		this.controlActor.destroy();
    		this.controlActor = undefined;
    	}
    }
    getNextStream = (streamId: string) => this.nextStreamMapping[streamId];
    displayPage = async (user: MyScreenUser, display = true, karaokeEnabled = false) => {
    	if (this.displayCardsBase) {
    		this.displayCardsBase.appearance.enabled = false;
    		for(const playButton of this.displayCardsBase.findChildrenByName(playButtonName, true) as MyScreenPlayButton[]) {
    			playButton.setBehavior(null);
    		}
    		// this.displayCardsBase.destroy();
    		this.clearDisplayedBase();
    		this.displayCardsBase = null;
    	}
    	// const existingCardBase = this.context.ytSelectionPanel?.children.find(v => v.name === 'cards-base');
    	// if (existingCardBase) {
    	//     existingCardBase.appearance.enabled = false;
    	//     try {
    	//         // existingCardBase.destroy();
    	//     } catch (err) {
    	//         console.error(err);
    	//     }
    	// }
    	const cacheKey = `yt-cards-base-${this.context.ytSelectionsPager.start}_20`;
    	let cardsBase = null; // this.cardsBaseCache[cacheKey];
    	if (!cardsBase) {
    		cardsBase = this.getCardsBase(cacheKey);
    		const gridLayout = new MRE.PlanarGridLayout(cardsBase, BoxAlignment.TopCenter);
    		const search = this.context.searchTerm + (karaokeEnabled ? ' karaoke' : '')
    		const streams = await getVideoStreamFromSearch(
    			search,
    			this.context.ytSelectionsPager,
    		); // TODO:
    		// auditStreamingData(user, "YouTube-Search", -1, search)
    		if (streams.length) {
    			// TODO: //this.context.ytSelectionsPager.totalCount = await countActiveStreams()
    			const cards = [];
    			const gridWidth = 6;
    			let i = 0;
    			let row = 0;
    			this.nextStreamMapping = {};
    			let prev: string;
    			let first: YouTubeVideoStream;
    			for (const stream of streams) {
    				if (!prev) {
    					first = stream;
    				} else {
    					this.nextStreamMapping[prev] = stream
    				}
    				prev = stream.id
    				const card = await this.createVideoCard(cardsBase, stream, i);
    				cards.push(card);
    				if (i % gridWidth === 0) {
    					row++;
    				}
    				gridLayout.addCell({
    					row,
    					height: 0.2,
    					column: gridWidth - (i % gridWidth),
    					// column: row === 1 ? i % MAX_COL : (MAX_COL - 1) - (i % MAX_COL),
    					width: .190,
    					contents: card.base
    				});
    				// this.context.displayedCards.push({playButton: card.playButton, selectedStream: stream, base: cardsBase});
    				i++;
    			}
    			if (prev && Object.keys(this.nextStreamMapping).length) {
    				this.nextStreamMapping[prev] = first;
    			}
    			gridLayout.applyLayout();
    			// this.cardsBaseCache[cacheKey] = cardsBase;
    		} else {
    			cardsBase = MRE.Actor.Create(this.context, {
    				actor: {
    					name: "no-results-found`",
    					parentId: this.context.ytSelectionPanel.id,
    					transform: {
    						local: {
    							position: {z: .01, y: 0, x: 0},
    							rotation: MRE.Quaternion.FromEulerAngles(0, -Math.PI, 0),
    							scale: {x: 1, y: 1, z: 1}
    						}
    					},
    					text: {
    						contents: "No results found",
    						pixelsPerLine: 12,
    						height: .2,
    						anchor: MRE.TextAnchorLocation.BottomCenter,
    						color: MRE.Color3.White(),
    						// font: TextFontFamily.Monospace,
    					}
    				}
    			});
    		}
    		try {
                this.displayCardsBase?.destroy();
    		} catch (err) {}
    		this.displayCardsBase = cardsBase;
    		cardsBase.appearance.enabled = display;
    	}
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

    closeMovieSelectionPicker = async () => {
    	if (this.context.ytSelectionPanel) {
    		try {
    			this.context.ytSelectionPanel.appearance.enabled = false;
    			this.context.ytSelectionsPager.displayed = false;
    			this.context.ytPagerButtons.closeButton.appearance.enabled = false;
    			// this.context.ytPagerButtons.prevPageButton.appearance.enabled = false;
    			// this.context.ytPagerButtons.nextPageButton.setBehavior(null);
    			this.context.ytPagerButtons.closeButton.setBehavior(null);
    			// this.context.ytPagerButtons.prevPageButton.setBehavior(null);
    			// this.displayCardsBase?.destroy();
    			// this.context.ytSelectionPanel.children?.forEach(value => {
    			//     value.appearance.enabled = false;
    			//     try {
    			//         value.destroy();
    			//     } catch (err) {
    			//
    			//     }
    			// })
    			// this.context.ytSelectionPanel.destroy()
    			// this.context.ytSelectionPanel = undefined;
    		} catch (err) {

    		}
    	}
    }

    setup = async () => {
    	if (!this.context.ytSelectionsPager) {
    		this.context.ytSelectionsPager = {
    			displayed: false,
    			pageSize,
    			start: 0,
    			totalCount: pageSize,
    			numberPages: 0,
    		}
    		this.context.ytSelectionsPager.totalCount = pageSize // TODO: await countActiveStreams();
    		this.context.ytSelectionsPager.numberPages = Math.ceil(this.context.ytSelectionsPager.totalCount / pageSize)
    	}
    	this.context.ytSelectionPanel = this.getBase();
		this.imageButtonMesh = this.assets.createPlaneMesh(`plane-movie-card-mesh`, 0.075, 0.075);
    	this.controlActor = MRE.Actor.Create(this.context, {
    		actor: {
    			// exclusiveToUser: id,
    			name: `yt-pager-controls-3d-wrapper`,
    			// grabbable: true,
    			parentId: this.context.ytSelectionPanel.id, // TODO: Play Actor
    			transform: {
    				local: {
    					position: {
    						y: 0, x: 0
    						// z: -2.2, x: 12.5,
    					},
    					rotation: MRE.Quaternion.FromEulerAngles(0, -Math.PI, 0),
    					scale: {
    						x: 1, y: 1.0, z: 1.0,
    						// x: 10, y: 10, z: 10,
    					}
    				}
    			}
    		}
    	});
    	// const {
    	//     playButton: prevPageButton,
    	//     root: prevPageRoot
    	// } = this.getMediaControlButton("prev-page-button", "artifact:1949940423736688761", this.controlActor);
    	// const {
    	//     playButton: nextPageButton,
    	//     root: nextPageRoot
    	// } = this.getMediaControlButton("next-page-button", "artifact:1949940424256782460", this.controlActor);
		const lCloseBtnMat = this.getImageButtonMaterial('stop', '/images/Close-Circle.png');
    	const {
    		playButton: closeButton,
    		root: closeRoot
    	} = this.getMediaControlButton3("close-button",  this.controlActor, this.imageButtonMesh, lCloseBtnMat);
    	const width = .14;
    	const controlLayout = new MRE.PlanarGridLayout(this.controlActor);
    	// prevPageRoot.appearance.enabled = false;
    	// nextPageRoot.appearance.enabled = false;
    	// controlLayout.addCell({
    	//     row: 0, column: 0, width, height: 0.1, contents: prevPageRoot,
    	// })
    	controlLayout.addCell({
    		row: 0, column: 1, width, height: 0.1, contents: closeRoot
    	})
    	// controlLayout.addCell({
    	//     row: 0, column: 2, width, height: 0.1, contents: nextPageRoot
    	// })
    	// nextPageButton.appearance.enabled = false;
    	// prevPageButton.appearance.enabled = false;
    	this.context.ytPagerButtons = {
    		closeButton,
    	}
    	controlLayout.applyLayout();
    	// this.prefetch();
    }
    displayMovieSelectionPicker = async (soloUser: MyScreenUser, karaokeEnabled = false) => {
    	const openPanel = async (refreshCardBase = true) => {
    		this.context.ytSelectionsPager.displayed = true;
    		this.context.ytSelectionPanel.appearance.enabled = true;
    		// this.context.ytSelectionPanel.findChildrenByName('lighter-wrapper', false)[0].light.enabled = false;//true;
    		this.context.ytPagerButtons.closeButton.appearance.enabled = true;
    		if (refreshCardBase) {
    			await this.displayPage(soloUser, true, karaokeEnabled);
    		}
    		await this.attachBehaviors();
    	}

    	if (this.displayCardsBase && !this.context.ytSelectionPanel.appearance.enabled) {
    		await openPanel(false);
    	}
    	const val = await soloUser.prompt(`Enter keywords to search for ${karaokeEnabled ? 'Karaoke songs' : "YouTube videos"}.`, true);
    	if (val?.submitted && val?.text) {
    		this.context.searchTerm = val?.text;
    	}
    	if (this.context.searchTerm && this.context.searchTerm!== this.previousSearch) {
    		this.previousSearch = this.context.searchTerm;
    		if (this.context.ytSelectionPanel.appearance.enabled) {
    			await this.closeMovieSelectionPicker();
    		}
    		if (!this.context.ytSelectionPanel.appearance.enabled) {
    			await openPanel();
    		}
    	}
    }
    handlePageNextButton = async (soloUser: MyScreenUser) => {
    	if (this.context.ytSelectionsPager && !this.context.ignoreClicks && this.context.ytSelectionPanel.appearance.enabled) {
    		this.context.ignoreClicks = true;
    		try {
    			this.context.ytSelectionsPager.start += pageSize;
    			this.context.ytSelectionsPager.pageSize = pageSize;
    			if (this.context.ytSelectionsPager.start > this.context.ytSelectionsPager.totalCount) {
    				this.context.ytSelectionsPager.start = 0;
    			}
    			// await this.displayPage();
    			this.attachBehaviors();
    		} finally {
    			this.context.ignoreClicks = false;
    		}
    	}
    }
    handlePrevPageButton = async (soloUser: MyScreenUser) => {
    	if (this.context.ytSelectionsPager && !this.context.ignoreClicks && this.context.ytSelectionPanel.appearance.enabled) {
    		this.context.ignoreClicks = true;
    		try {
    			this.context.ytSelectionsPager.start -= pageSize;
    			this.context.ytSelectionsPager.pageSize = pageSize;
    			if (this.context.ytSelectionsPager.start < 0) {
    				this.context.ytSelectionsPager.start = 0;
    			}
    			// await this.displayPage();
    			this.attachBehaviors();
    		} finally {
    			this.context.ignoreClicks = false;
    		}
    	}
    }
    handleCloseButton = async (soloUser: MyScreenUser) => {
    	if (this.context.ytSelectionsPager && !this.context.ignoreClicks && this.context.ytSelectionPanel.appearance.enabled) {
    		try {
    			await this.closeMovieSelectionPicker();
    		} finally {
    			this.context.ignoreClicks = false;
    		}
    	}
    }

    handlePlayCardButton = (selectedStream: YouTubeVideoStream) => async (soloUser: MyScreenUser) => {
    	if (!this.context.ignoreClicks) {
    		this.context.ignoreClicks = true;
    		try {
    			await this.mediaControlHandler.handlePlayButtonClick(soloUser, selectedStream)
    			await this.closeMovieSelectionPicker();
    		} finally {
    			this.context.ignoreClicks = false;
    		}
    	}
    }

    attachBehaviors = async () => {
    	if (this.context?.ytSelectionPanel?.appearance?.enabled) {
    		// if (this.context?.ytPagerButtons?.nextPageButton) {
    		//     this.context.ytPagerButtons.nextPageButton.setBehavior(MRE.ButtonBehavior).onClick(this.handlePageNextButton)
    		// }
    		// if (this.context?.ytPagerButtons?.prevPageButton) {
    		//     this.context.ytPagerButtons.prevPageButton.setBehavior(MRE.ButtonBehavior).onClick(this.handlePrevPageButton)
    		// }
    		if (this.context?.ytPagerButtons?.closeButton) {
                this.context?.ytPagerButtons.closeButton.setBehavior(MRE.ButtonBehavior).onClick(this.handleCloseButton)
    		}
    		// Play buttons
    		// MyScreenPlayButton
    		for(const playButton of this.displayCardsBase?.findChildrenByName(playButtonName, true) as MyScreenPlayButton[]) {
    			playButton.setBehavior(MRE.ButtonBehavior).onClick(this.handlePlayCardButton(playButton.selectedStream))
    		}
    	}
    }

    getCardsBase = (name: string) => MRE.Actor.Create(this.context, {
    	actor: {
    		name,
    		parentId: this.context.ytSelectionPanel.id,
    		appearance: {enabled: false},
    		subscriptions: ["transform"],
    		collider: {
    			geometry: {
    				shape: MRE.ColliderType.Auto
    			},
    			isTrigger: true
    		},
    		transform: {
    			local: {
    				scale: {x: chooserScale, y: chooserScale, z: chooserScale},
    				position: {x: 0, y: 0}
    			}
    		}
    	}
    });


    getBase = () => MRE.Actor.Create(this.context, {
    	actor: {
    		name: `YT_VideoSelectionRoot`,
    		appearance: {enabled: false},
    		collider: {
    			geometry: {
    				shape: MRE.ColliderType.Auto
    			},
    			isTrigger: true
    		},
    		transform: {
    			local: {
    				rotation: MRE.Quaternion.FromEulerAngles(0, -Math.PI, 0),
    				// scale: {x: 100.25, y: 100.25, z: 100.25},
    				position: {z: -.05, y: -.35, x: 0}
    			}
    		}
    	}
    });

    createVideoCard = async (parent: MRE.Actor, videoStream: YouTubeVideoStream, index: number) => {
    	// const currStream = context.currentStream;
    	const promises = [];
    	const base = MRE.Actor.Create(
    		this.context, {
    			actor: {
    				name: `card-base--${videoStream.id}-root`,
    				parentId: parent.id,
    				collider: {
    					geometry: {
    						shape: MRE.ColliderType.Auto
    					},
    					isTrigger: true
    				}
    			}
    		});
    	const container = MRE.Actor.Create(
    		this.context, {
    			actor: {
    				name: `card-base-${videoStream.id}-root`,
    				parentId: base.id,
    				transform: { local: { position: { x: 0} } },
    				collider: {
    					geometry: {
    						shape: MRE.ColliderType.Auto
    					},
    					isTrigger: true
    				}
    			}
    		});
    	const scaleFactor = 0.12;
    	const photo = MRE.Actor.Create(this.context, {
    		actor: {
    			name: `photo-actor-${videoStream.id}`,
    			parentId: container.id,
    			appearance: {
    				meshId: this.movieCardMesh.id,
    				// TODO:  Support Selected
    				materialId: this.getMovieCardMaterial(videoStream).id,
    			},
    			transform: {
    				local: {
    					position: { x:-0.025, y: .07 },
    					// rotation: {x: 0, y: 90, z: 90},
    					rotation: MRE.Quaternion.FromEulerAngles(-Math.PI * .5, Math.PI * 1, Math.PI * 0),
    					scale: {x: scaleFactor, y: scaleFactor, z: scaleFactor},
    				}
    			},
    			collider: {
    				geometry: {
    					shape: MRE.ColliderType.Auto
    				},
    				isTrigger: true,
    			}
    		}
    	});
    	const playButtonMaterial = this.playButtonMaterial;
    	const playButtonBox = this.playButtonMesh;
    	const titleLabel = MRE.Actor.Create(this.context, {
    		actor: {
    			name: playButtonLabel,
    			parentId: container.id,
    			transform: {
    				local: {
    					position: {z: 0.005, y: .01, x: 0.06},
    					rotation: MRE.Quaternion.FromEulerAngles(0, -Math.PI, 0),
    				}
    			},
    			text: {
    				contents: wordWrap(videoStream.title?.replace(/[^\x20-\x7E]/g, ""), { width: 40, indent: "", trim: true, cut: false})
                        + `\nby ${videoStream.author?.replace(/[^\x20-\x7E]/g, "")}`
                        + `\n\nTime:  ${videoStream.duration}`,
    				pixelsPerLine: 12,
    				height: 0.0085,
    				anchor: MRE.TextAnchorLocation.TopLeft,
    				color: MRE.Color3.White(),
    				// font: TextFontFamily.Monospace,
    			}
    		}
    	});
    	// const playing = this.context.screenType === 'yt' && this.context.currentStream === videoStream.id;
    	const playing = false;
    	const playButton = MRE.Actor.Create(this.context,
    		{
    			actor: {
    				parentId: container.id,
    				name: playButtonName,
    				appearance: {
    					meshId: playButtonBox.id,
    					materialId: playing ? this.currentPlayMaterial.id : playButtonMaterial.id,
    					enabled: true
    				},
    				transform: {
    					local: {
    						position: {x: -.080, y: -0.035, z: 0.0015},
    						rotation: base.transform.local.rotation,
    						scale: {x: 1.5, y: 1.5, z: 1.5}
    					}
    				},
    				collider: {
    					geometry: {
    						shape: MRE.ColliderType.Auto
    					},
    					isTrigger: true
    				}
    			}
    		}
    	);
    	(playButton as MyScreenPlayButton).selectedStream = videoStream;
    	promises.push(playButton.created());
    	const label = MRE.Actor.Create(this.context, {
    		actor: {
    			name: playButtonLabel,
    			parentId: playButton.id,
    			transform: {
    				local: {
    					position: {z: 0.002, y: 0},
    					rotation: {y: 45}
    				}
    			},
    			text: {
    				contents: playing ? "Playing" : "Play",
    				pixelsPerLine: 12,
    				height: 0.008,
    				anchor: MRE.TextAnchorLocation.MiddleCenter,
    				color: MRE.Color3.White(),
    			}
    		}
    	});
    	promises.push(label.created());
    	// await Promise.all(promises);
    	return {base, playButton, videoStream };
    };

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
}
