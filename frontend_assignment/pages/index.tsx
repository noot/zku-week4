import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { useForm } from "react-hook-form";
import { object, string, number, date, InferType } from 'yup';
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"

let userSchema = object({ 
  name: string().required(),
  age: number().required().positive().integer(),
  address: string().required(),
})

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [logs2, setLogs2] = React.useState("Greeting: ")

    const { register, handleSubmit, watch, formState: { errors } } = useForm();
    const onSubmit = async function (data) {
        const validatedData = await userSchema.validate(data);
        console.log(validatedData);
    };

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)

        const localProvider = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi).connect(ethersProvider)
        contract.on("NewGreeting", (greeting) => {
            console.log(greeting)
            setLogs2(greeting)
        })

        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div className={styles.greeting}>{logs2}</div>

                <form onSubmit={handleSubmit(onSubmit)}>
                  {/* register your input into the hook by invoking the "register" function */}
                  <input defaultValue="name" {...register("name")} />
                  <input defaultValue="age" {...register("age")} />
                  <input defaultValue="address" {...register("address")} />

                  <input type="submit" />
                </form>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
            </main>
        </div>
    )
}
