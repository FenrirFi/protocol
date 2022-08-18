import hre, { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { numToWei } from "../utils/utils";
import { verifyContract } from "./common/verify-contract";

const outputFilePath = `./deployments/${hre.network.name}.json`;
const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));
const delegates = deployments.CErc20Delegates;
const delegate = delegates[delegates.length - 1];

const CTOKEN_DECIMALS = 8;

// CToken Params
const params = {
  underlying: "0x69fdb77064ec5c84FA2F21072973eB28441F43F3",
  irModel: "0xC115a318D8107491d27c627E0E2bD98F52a3BC53",
  name: "Fenrir Tethys",
  symbol: "fTETHYS",
  decimals: CTOKEN_DECIMALS,
  unitrollerAddr: deployments.Unitroller,
  implementation: delegate,
  becomeImplementationData: "0x",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);
  console.log(`CErc20Delegate to be used: ${delegate}`);

  const erc20Underlying = await ethers.getContractAt(
    "EIP20Interface",
    params.underlying
  );
  const underlyingDecimals = await erc20Underlying.decimals();
  const totalDecimals = underlyingDecimals + params.decimals;
  const initialExcRateMantissaStr = numToWei("2", totalDecimals);

  const CErc20Delegator = await ethers.getContractFactory("CErc20Delegator");
  const cErc20Delegator = await CErc20Delegator.deploy(
    params.underlying,
    params.unitrollerAddr,
    params.irModel,
    initialExcRateMantissaStr,
    params.name,
    params.symbol,
    params.decimals,
    deployer.address,
    params.implementation,
    params.becomeImplementationData
  );
  await cErc20Delegator.deployed();
  console.log("CErc20Delegator deployed to:", cErc20Delegator.address);

  const unitrollerProxy = await ethers.getContractAt(
    "Comptroller",
    params.unitrollerAddr
  );

  console.log("calling unitrollerProxy._supportMarket()");
  await (await unitrollerProxy._supportMarket(cErc20Delegator.address)).wait(3);

  if (!deployments.Markets) deployments.Markets = {};
  deployments.Markets[params.symbol] = cErc20Delegator.address;
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));

  await cErc20Delegator.deployTransaction.wait(15);
  await verifyContract(cErc20Delegator.address, [
    params.underlying,
    params.unitrollerAddr,
    params.irModel,
    initialExcRateMantissaStr,
    params.name,
    params.symbol,
    params.decimals,
    deployer.address,
    params.implementation,
    params.becomeImplementationData,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
