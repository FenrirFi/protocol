import hre, { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { toBn, numToWei } from "../utils/utils";
import { verifyContract } from "./common/verify-contract";

const outputFilePath = `./deployments/${hre.network.name}.json`;

// IR Model Params
const params = {
  baseRate: "0",
  kink: "80",
  multiplierPreKink: "20",
  multiplierPostKink: "100",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));

  const jumpMultiplier = getJumpMultiplier(
    params.kink,
    params.multiplierPreKink,
    params.multiplierPostKink
  );

  const baseRateWei = numToWei(toBn(params.baseRate).div(100), 18);
  const kinkWei = numToWei(toBn(params.kink).div(100), 18);
  const multiplierWei = numToWei(toBn(params.multiplierPreKink).div(100), 18);
  const jumpMultiplierWei = numToWei(toBn(jumpMultiplier).div(100), 18);

  const JumpRateModelV2 = await ethers.getContractFactory("JumpRateModelV2");
  const jumpRateModelV2 = await JumpRateModelV2.deploy(
    baseRateWei,
    multiplierWei,
    jumpMultiplierWei,
    kinkWei,
    deployer.address
  );
  await jumpRateModelV2.deployed();

  console.log(`JumpRateModelV2 deployed to: ${jumpRateModelV2.address}.`);

  // save data
  if (!deployments.JumpRateModelV2) deployments.JumpRateModelV2 = {};

  deployments.JumpRateModelV2[
    `${params.baseRate}__${params.kink}__${params.multiplierPreKink}__${params.multiplierPostKink}`
  ] = jumpRateModelV2.address;
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));

  await jumpRateModelV2.deployTransaction.wait(15);
  await verifyContract(jumpRateModelV2.address, [
    baseRateWei,
    multiplierWei,
    jumpMultiplierWei,
    kinkWei,
    deployer.address,
  ]);
}

const getJumpMultiplier = (
  kink: string,
  multiplierPreKink: string,
  multiplierPostKink: string
): string => {
  return toBn(multiplierPostKink)
    .minus(multiplierPreKink)
    .div(toBn(100).minus(kink))
    .times(100)
    .toFixed();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
