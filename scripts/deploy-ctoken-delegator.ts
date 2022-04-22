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
  underlying: "0x14016E85a25aeb13065688cAFB43044C2ef86784",
  irModel: "0x243415ce19991095b2105ba50d4cBa3D1de32695",
  name: "Fenrir TUSD",
  symbol: "fTUSD",
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
