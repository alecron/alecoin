import * as CryptoJS from 'crypto-js';
import { broadcastLatest } from './p2p';
import { hexToBinary } from './utils';

// This first version is almost a copy of the tutorial, but I'm adding some comments and some functions that are not explained in the tutorial
//      TODO: Improve the code organization and add more comments
class Block {
    public index: number;
    public data: string;
    public timestamp: number;
    public hash: string;
    public previousHash: string;

    // Chapter 2 - Proof of Work
    public difficulty: number;  // This is the number of zeros that the hash must start with
    public nonce: number;    // This is the number that will be modified to find the correct hash
    // “Mining” is basically just trying a different nonce until the block hash matches the difficulty

    constructor(index: number, data: string, timestamp: number, hash: string, previousHash: string,
        difficulty: number, nonce: number
    ) {
        this.index = index;
        this.data = data;
        this.timestamp = timestamp;
        this.hash = hash;
        this.previousHash = previousHash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }

}

// MAIN VARIABLES -- BLOCKCHAIN DEFINITION
const genesisBlock: Block = new Block(0, "Genesis Block", 1465154705, "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7", '', 0, 0);

let blockchain: Block[] = [genesisBlock];

const getBlockchain = (): Block[] => blockchain;

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

const sockets: WebSocket[] = [];

const generateNextBlock = (blockData: string): Block => {
    const previousBlock: Block = getLatestBlock();
    const difficulty: number = getDifficulty(getBlockchain());

    const nextIndex: number = previousBlock.index + 1;
    const nextTimestamp: number = getCurrentTimestamp();
    const newBlock: Block = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);
    addBlock(newBlock);
    broadcastLatest();
    return newBlock;
}
// ========================================

const calculateHash = (index: number, data: string, timestamp: number, previousHash: string, difficulty: number, nonce: number): string => {
    return CryptoJS.SHA256(index + data + timestamp + previousHash + difficulty + nonce).toString();
}

const calculateBlockHash = (block: Block): string => {
    return calculateHash(block.index, block.data, block.timestamp, block.previousHash, block.difficulty, block.nonce);
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
    } else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
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
    if (isAValidChain(newBlocks) &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
}

// Chapter 2 - Proof of Work
const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

// "Mining" function
const findBlock = (index: number, previousHash: string, timestamp: number, data: string, difficulty: number): Block => {
    let nonce = 0;
    while (true) {
        const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, data, timestamp, hash, previousHash, difficulty, nonce);
        }
        nonce++;
    }
};

const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateBlockHash(block);
    return blockHash === block.hash;
};

const hasValidHash = (block: Block): boolean => {

    if (!hashMatchesBlockContent(block)) {
        console.log('invalid hash, got:' + block.hash);
        return false;
    }

    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
    }
    return true;
};


// in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

/**
 * Adjust the difficulty of the blockchain by comparing the time taken to mine the last block with the expected time
 * @param latestBlock 
 * @param aBlockchain 
 * @returns 
 */
const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};

/**
 * Get the current difficulty of the blockchain (number of zeros that the hash must start with on its binary representation)
 * @param aBlockchain it is obviously the blockchain
 * @returns 
 */
const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};

const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};

const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    return (previousBlock.timestamp - 60 < newBlock.timestamp)
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};


export { Block, getBlockchain, getLatestBlock, generateNextBlock, isValidBlockStructure, addBlock, replaceChain };