import hre, { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { toBn, numToWei } from "../utils/utils";

const outputFilePath = `./deployments/${hre.network.name}.json`;

// IR Model Params
const params = {
  blocksPerYear: "2425000",
  baseRate: "0",
  kink: "80",
  multiplierPreKink: "20",
  multiplierPostKink: "100",
  admin: "0xED5fdB993497789C3a589fdE41bBD751eD723A3E",
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));

  const jumpMultiplier = getJumpMultiplier(params.kink, params.multiplierPreKink, params.multiplierPostKink);

  const baseRateWei = numToWei(toBn(params.baseRate).div(100), 18);
  const kinkWei = numToWei(toBn(params.kink).div(100), 18);
  const multiplierWei = numToWei(toBn(params.multiplierPreKink).div(100), 18);
  const jumpMultiplierWei = numToWei(toBn(jumpMultiplier).div(100), 18);

  const JumpRateModelV2U = await ethers.getContractFactory("JumpRateModelV2U");
  const jumpRateModelV2U = await JumpRateModelV2U.deploy(
    params.blocksPerYear,
    baseRateWei,
    multiplierWei,
    jumpMultiplierWei,
    kinkWei,
    params.admin,
  );
  await jumpRateModelV2U.deployed();

  console.log(`JumpRateModelV2U deployed to: ${jumpRateModelV2U.address}.`);

  // save data
  if (!deployments["IRModels"]) deployments["IRModels"] = {};
  if (!deployments["IRModels"]["JumpRateModelV2U"]) deployments["IRModels"]["JumpRateModelV2U"] = {};

  deployments["IRModels"]["JumpRateModelV2U"]
  [`${params.baseRate}__${params.kink}__${params.multiplierPreKink}__${params.multiplierPostKink}`] = jumpRateModelV2U.address;
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));
}

const getJumpMultiplier = (kink: string, multiplierPreKink: string, multiplierPostKink: string): string => {
  return toBn(multiplierPostKink)
    .minus(multiplierPreKink)
    .div(toBn(100).minus(kink))
    .times(100).toFixed();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});