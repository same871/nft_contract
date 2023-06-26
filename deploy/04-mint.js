const { ethers, network } = require("hardhat")

module.exports = async function ({ getNamedAccounts }) {
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // Basic Nft
    const basicNft = await ethers.getContract("BasicNft", deployer)
    const basicMintTx = await basicNft.mintNft()
    await basicMintTx.wait(1)
    console.log(`Basic NFT index 0 has tokenURI: ${await basicNft.tokenURI(0)}`)

    // random ipfs nft
    const randomIpfsNft = await ethers.getContract("RandomIpfsNft", deployer)
    const mintFee = await randomIpfsNft.getMintFee()
    const randomIpfsNftTx = await randomIpfsNft.requestNft({ value: mintFee.toString() })
    const randomIpfsNftTxRecept = await randomIpfsNftTx.wait(1)
    // need to listen for events
    await new Promise(async (resolve, reject) => {
        setTimeout(() => reject("Timeout: 'NFTMinted' event did not fire"), 30000) // 5 minute timeout time
        // setup listener for our event
        randomIpfsNft.once("NftMinted", async () => {
            console.log(`Random IPFS NFT index 0 tokenURI: ${await randomIpfsNft.tokenURI(0)}`)
            resolve()
        })
        if (chainId == 31337) {
            const requestId = randomIpfsNftTxRecept.events[1].args.requestId.toString()
            const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, randomIpfsNft.address)
        }
    })

    // Dynamic svg
    const highValue = ethers.utils.parseEther("2000")
    const dynamicSvgNft = await ethers.getContract("DynamicSvgNft", deployer)
    const dynamicSvgNftTx = await dynamicSvgNft.mintNft(highValue)
    await dynamicSvgNftTx.wait(1)
    console.log(`Dynamic SVG NFT index 0 tokenURI: ${await dynamicSvgNft.tokenURI(0)}`)
}

module.exports.tags = ["all", "mint"]
