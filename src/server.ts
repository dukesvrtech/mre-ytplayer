/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import * as Restify from 'restify';
import dotenv from 'dotenv';
import {resolve as resolvePath} from 'path';
import App from './app';
import {getVideoStreamFromYT} from "./services/yt-service";

// add some generic error handlers here, to log any exceptions we're not expecting
process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));

// Read .env if file exists
dotenv.config();

const streamVideo = async (req: Restify.Request, res: Restify.Response, next: Restify.Next) => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const queryMap = require('querystring')?.parse(req.getQuery());
	console.log("Received Watch Request", queryMap);
	const v = queryMap?.v
	if (!v) {
		return res.send(400, 'Missing v request parameter')
	}
	const videoStream = await getVideoStreamFromYT(v);
	res.redirect(302, videoStream.uri, next);
}

// This function starts the MRE server. It will be called immediately unless
// we detect that the code is running in a debuggable environment. If so, a
// small delay is introduced allowing time for the debugger to attach before
// the server starts accepting connections.
function runApp() {
	// Start listening for connections, and serve static files.
	const server = new MRE.WebHost({
		baseDir: resolvePath(__dirname, '../public'),
	});

	server.ready.then(value => {
		// Run pre MRE start tasks here.  E.g
		console.log("MRE is ready for Avatars")

		// Setup up routes for server side processing.  Must configure host in environment variable.
		server.adapter.server.get('/watch', streamVideo);

		// Handle new application sessions
		server.adapter.onConnection((context, params) => {
			return new App(context, params)
		});
	});
}

// Check whether code is running in a debuggable watched filesystem
// environment and if so, delay starting the Index by one second to give
// the debugger time to detect that the server has restarted and reconnect.
// The delay value below is in milliseconds so 1000 is a one second delay.
// You may need to increase the delay or be able to decrease it depending
// on the speed of your machine.
const delay = 1000;
const argv = process.execArgv.join();
const isDebug = argv.includes('inspect') || argv.includes('debug');

if (isDebug) {
	setTimeout(runApp, delay);
} else {
	runApp();
}
