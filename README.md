# My Screen Mirror MRE
Toggles between 3D and 2D screen by just clicking the screen.

## Install
```
npm install
cp .env.template .env
```

Update the `.env` file with BASE_URL and Port

```
npm run build
npm start
```

## VR Setup
1. Open World Builder Tools
1. Add SDK in Altspace
1. Enter: ws://<host>:<port> to node server

## Development
```
npm run debug
npm run debug-watch
npm run debug-watch-brk
```
Open Chrome and goto: chrome://inspect/#devices

