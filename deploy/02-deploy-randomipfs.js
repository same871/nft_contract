const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")
require("dotenv").config()

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("5")
const imagesLocation = "./images/random"
const metaDataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "cuteness",
            value: 100,
        },
    ],
}

let tokenUris = [
    "ipfs://QmfGvc9JynDLxTY41XA6b8598XvcqEBuCDmmjF4W6pqXr2",
    "ipfs://Qmf3wUfzX8jXrK7DHBXS4ZdSVmeouJcyLtxpJJrNjCRVyB",
    "ipfs://QmdsMpGt2SzsS1zBfshXusXt4sEv27eVFT4WtEYpAF2ULk",
]
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // get the ipfs hashes of our images
    if (process.env.UPLOAD_TO_PINATA == "true") {
        tokenUris = await handleTokenUris()
    }

    let vrfCoodinatorV2Address, subscriptionId, vrfCoodinatorV2Mock

    if (developmentChains.includes(network.name)) {
        vrfCoodinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoodinatorV2Address = vrfCoodinatorV2Mock.address
        const transactionResponse = await vrfCoodinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        // Fund the subscription
        await vrfCoodinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
        console.log("Finished the smart contract type here")
    } else {
        vrfCoodinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const mintFee = networkConfig[chainId]["mintFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    log("--------------------")

    const args = [
        vrfCoodinatorV2Address,
        subscriptionId,
        gasLane,
        callbackGasLimit,
        tokenUris,
        mintFee,
    ]
    console.log("Deploying the Lottery")
    const randomIPFSNft = await deploy("RandomIpfsNft", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    // adding a consumer to vrfCoordinator
    await vrfCoodinatorV2Mock.addConsumer(subscriptionId, randomIPFSNft.address)

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(randomIPFSNft.address, args)
    }
    log("______________________________________")
}

async function handleTokenUris() {
    tokenUris = []
    // store the image in IPFS
    // store the metadata in IPFS
    const { responses: imageUploadResponses, files } = await storeImages(imagesLocation)
    for (imageUploadResponseIndex in imageUploadResponses) {
        // create a metadata
        // upload the metadata
        let tokenUriMetadata = { ...metaDataTemplate }
        tokenUriMetadata.name = files[imageUploadResponseIndex].replace(".png", "")
        tokenUriMetadata.description = `An adorable ${tokenUriMetadata.name} pup`
        tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
        console.log(`uploading ${tokenUriMetadata.name}...`)
        // store the json to pinata /ipfs
        const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
        tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }
    console.log("Token URIs metadata uploaded! They are: ")
    console.log(tokenUris)

    return tokenUris
}

module.exports.tags = ["all", "randomIpfs"]
