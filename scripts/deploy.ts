import hre from 'hardhat';

async function main() {
    const DocumentNotary = await hre.ethers.getContractFactory('DocumentNotary');
    const documentNotary = await DocumentNotary.deploy();

    await documentNotary.waitForDeployment();

    console.log(
        'DocumentNotary deployed to:',
        await documentNotary.getAddress()
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});