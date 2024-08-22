import * as CryptoJS from 'crypto-js';
import { broadcastLatest } from './p2p';


// This first version is almost a copy of the tutorial, but I'm adding some comments and some functions that are not explained in the tutorial
//      TODO: Improve the code organization and add more comments
class Block {
    public index: number;
    public data: string;
    public timestamp: number;
    public hash: string;
    public previousHash: string;

    constructor(index: number, data: string, timestamp: number, hash: string, previousHash: string) {
        this.index = index;
        this.data = data;
        this.timestamp = timestamp;
        this.hash = hash;
        this.previousHash = previousHash;
    }

}

// MAIN VARIABLES -- BLOCKCHAIN DEFINITION
const genesisBlock: Block = new Block(0, "Genesis Block", 1465154705, "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7", '');

let blockchain: Block[] = [genesisBlock];

const getBlockchain = (): Block[] => blockchain;

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

const sockets: WebSocket[] = [];

const generateNextBlock = (blockData: string): Block => {
    // Note: The getLatestBlock function is not directly implemented in the tutorial
    const previousBlock: Block = getLatestBlock();
    const nextIndex: number = previousBlock.index + 1;
    const nextTimestamp: number = new Date().getTime() / 1000;
    const nextHash: string = calculateHash(nextIndex, blockData, nextTimestamp, previousBlock.hash);
    return new Block(nextIndex, blockData, nextTimestamp, nextHash, previousBlock.hash);
}
// ========================================

const calculateHash = (index: number, data: string, timestamp: number, previousHash: string): string => {
    return CryptoJS.SHA256(index + data + timestamp + previousHash).toString();
}

const calculateBlockHash = (block: Block): string => {
    return calculateHash(block.index, block.data, block.timestamp, block.previousHash);
}


// NOTE: This is not being used? 
// I think that the tutorial misses a lot of things... I'm Adding it myself to the function
const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'string';
}

/**
 * For a block to be valid the following must apply:
 *    .- The index of the block must be one number larger than the previous
 *    .- The previousHash of the block match the hash of the previous block
 *    .- The hash of the block itself must be valid
 * 
 * @param newBlock  The block to be validated
 * @param previousBlock  The previous block
 * @returns true when the block is valid, false otherwise
*/
const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid structure');
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previous hash');
        return false;
    } else if (calculateBlockHash(newBlock) !== newBlock.hash) {
        console.log('invalid hash');
        return false;
    }
    return true;
}

const addBlock = (newBlock: Block): boolean => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
        return true;
    }

    return false;
}

const isAValidChain = (blockchainToValidate: Block[]): boolean => {
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    }

    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }

    for (let i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }
    return true;
}

const replaceChain = (newBlocks: Block[]) => {
    if (isAValidChain(newBlocks) && newBlocks.length > getBlockchain.length) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;

        // Todo: broadcastLatest(); -- Not explained again....
        broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
}

export { Block, getBlockchain, getLatestBlock, generateNextBlock, isValidNewBlock, isValidBlockStructure, addBlock, replaceChain };