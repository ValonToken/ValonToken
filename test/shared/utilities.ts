import {Contract, ethers} from 'ethers';
//import {BigNumber, ethers.BigNumber.from, keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack, getAddress} from 'ethers/utils'

export const MINIMUM_LIQUIDITY = ethers.BigNumber.from(10).pow(3)

const PERMIT_TYPEHASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

export function expandTo18Decimals(n: number | string): ethers.BigNumber {
  return ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(18))
}

export function _to18Digits(n: number | string, decimals: number): ethers.BigNumber {
  return ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(18 - decimals))
}

function getDomainSeparator(name: string, tokenAddress: string) {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name)),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes('1')),
        1,
        tokenAddress
      ]
    )
  )
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    ethers.utils.keccak256(ethers.utils.solidityPack(['address', 'address'], [token0, token1])),
    ethers.utils.keccak256(bytecode)
  ]
  const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return ethers.utils.getAddress(`0x${ethers.utils.keccak256(sanitizedInputs).slice(-40)}`)
}

export async function getApprovalDigest(
  token: Contract,
  approve: {
    owner: string
    spender: string
    value: ethers.BigNumber
  },
  nonce: ethers.BigNumber,
  deadline: ethers.BigNumber
): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address)
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        )
      ]
    )
  )
}

export function encodePrice(reserve0: ethers.BigNumber, reserve1: ethers.BigNumber) {
  return [reserve1.mul(ethers.BigNumber.from(2).pow(112)).div(reserve0), reserve0.mul(ethers.BigNumber.from(2).pow(112)).div(reserve1)]
}
