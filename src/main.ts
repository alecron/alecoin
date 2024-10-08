import express from 'express';
import bodyParser from 'body-parser';

import { Block, generateNextBlock, getBlockchain } from './blockchain';
import { connectToPeers, getSockets, initP2PServer } from './p2p';

const http_port = parseInt(process.env.HTTP_PORT || '3001');
const p2p_port = parseInt(process.env.P2P_PORT || '6001');

// Build a basic HTTP server to interact with the blockchain's
// node.
const initHttpServer = (myHttpPort: number) => {
    const app = express();
    app.use(bodyParser.json());

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain());
    });
    app.post('/mineBlock', (req, res) => {
        const newBlock: Block = generateNextBlock(req.body.data);
        res.send(newBlock);
    });
    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(http_port);
initP2PServer(p2p_port);