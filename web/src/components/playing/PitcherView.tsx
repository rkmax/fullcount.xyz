import { Flex, Spinner, Text } from "@chakra-ui/react";
import globalStyles from "../GlobalStyles.module.css";
import styles from "./PlayView.module.css";
import GridComponent from "./GridComponent";
import { useContext, useEffect, useState } from "react";
import { getPitchDescription, getRowCol } from "./PlayView";
import { signPitch } from "../../utils/signing";
import Web3Context from "../../contexts/Web3Context/context";
import { useGameContext } from "../../contexts/GameContext";
import { useMutation, useQueryClient } from "react-query";
import useMoonToast from "../../hooks/useMoonToast";
import { SessionStatus } from "./PlayView";
import FullcountABIImported from "../../web3/abi/FullcountABI.json";
import { AbiItem } from "web3-utils";

import { sendTransactionWithEstimate } from "../../utils/sendTransactions";
import RandomGenerator from "./RandomGenerator";
const FullcountABI = FullcountABIImported as unknown as AbiItem[];

const PitcherView = ({ sessionStatus }: { sessionStatus: SessionStatus }) => {
  const [speed, setSpeed] = useState(0);
  const [gridIndex, setGridIndex] = useState(-1);
  const [isRevealed, setIsRevealed] = useState(false);
  const [nonce, setNonce] = useState("");
  const web3ctx = useContext(Web3Context);
  const { selectedSession, contractAddress, selectedToken } = useGameContext();
  const [showTooltip, setShowTooltip] = useState(false);
  const gameContract = new web3ctx.web3.eth.Contract(FullcountABI) as any;
  gameContract.options.address = contractAddress;

  const handleCommit = async () => {
    if (gridIndex === -1) {
      setShowTooltip(true);
      setTimeout(() => {
        setShowTooltip(false);
      }, 3000);
      return;
    }
    const sign = await signPitch(
      web3ctx.account,
      window.ethereum,
      nonce,
      speed,
      getRowCol(gridIndex)[0],
      getRowCol(gridIndex)[1],
    );
    localStorage.setItem(
      `fullcount.xyz-${contractAddress}-${selectedSession?.sessionID}-${selectedToken?.id}`,
      JSON.stringify({
        nonce,
        speed,
        vertical: getRowCol(gridIndex)[0],
        horizontal: getRowCol(gridIndex)[1],
      }),
    );
    commitPitch.mutate({ sign });
  };

  const handleReveal = async () => {
    const item =
      localStorage.getItem(
        `fullcount.xyz-${contractAddress}-${selectedSession?.sessionID}-${selectedToken?.id}` ?? "",
      ) ?? "";
    const reveal = JSON.parse(item);
    revealPitch.mutate({
      nonce: reveal.nonce,
      speed: reveal.speed,
      vertical: reveal.vertical,
      horizontal: reveal.horizontal,
    });
  };

  useEffect(() => {
    // setMovements([]);
    const item =
      localStorage.getItem(
        `fullcount.xyz-${contractAddress}-${selectedSession?.sessionID}-${selectedToken?.id}` ?? "",
      ) ?? "";
    if (item) {
      const reveal = JSON.parse(item);
      setSpeed(reveal.speed);
      setGridIndex(reveal.vertical * 5 + reveal.horizontal);
    }
  }, [selectedSession]);

  const toast = useMoonToast();
  const queryClient = useQueryClient();

  const commitPitch = useMutation(
    async ({ sign }: { sign: string }) => {
      if (!web3ctx.account) {
        return new Promise((_, reject) => {
          reject(new Error(`Account address isn't set`));
        });
      }

      return sendTransactionWithEstimate(
        web3ctx.account,
        gameContract.methods.commitPitch(selectedSession?.sessionID, sign),
      );
    },
    {
      onSuccess: () => {
        queryClient.refetchQueries("sessions");
        queryClient.refetchQueries("session");
      },
      onError: (e: Error) => {
        toast("Commmit failed." + e?.message, "error");
      },
    },
  );

  const revealPitch = useMutation(
    async ({
      nonce,
      speed,
      vertical,
      horizontal,
    }: {
      nonce: string;
      speed: number;
      vertical: number;
      horizontal: number;
    }) => {
      if (!web3ctx.account) {
        return new Promise((_, reject) => {
          reject(new Error(`Account address isn't set`));
        });
      }

      return sendTransactionWithEstimate(
        web3ctx.account,
        gameContract.methods.revealPitch(
          selectedSession?.sessionID,
          nonce,
          speed,
          vertical,
          horizontal,
        ),
      );
    },
    {
      onSuccess: () => {
        setIsRevealed(true);
        queryClient.invalidateQueries("sessions");
        queryClient.refetchQueries("session");
      },
      onError: (e: Error) => {
        toast("Reveal failed." + e?.message, "error");
      },
    },
  );

  return (
    <Flex direction={"column"} gap={"15px"} alignItems={"center"}>
      <Text fontSize={"24px"} fontWeight={"700"}>
        One pitch to win the game
      </Text>
      <Text fontSize={"18px"} fontWeight={"500"}>
        1. Select the type of pitch
      </Text>
      <Flex justifyContent={"center"} gap={"20px"}>
        <Flex
          className={speed === 0 ? styles.activeChoice : styles.inactiveChoice}
          onClick={sessionStatus.didPitcherCommit ? undefined : () => setSpeed(0)}
          cursor={sessionStatus.didPitcherCommit ? "default" : "pointer"}
        >
          Fast
        </Flex>
        <Flex
          className={speed === 1 ? styles.activeChoice : styles.inactiveChoice}
          onClick={sessionStatus.didPitcherCommit ? undefined : () => setSpeed(1)}
          cursor={sessionStatus.didPitcherCommit ? "default" : "pointer"}
        >
          Slow
        </Flex>
      </Flex>
      <Text fontSize={"18px"} fontWeight={"500"}>
        2. Choose where to pitch
      </Text>
      <GridComponent
        selectedIndex={gridIndex}
        isPitcher={true}
        setSelectedIndex={sessionStatus.didPitcherCommit ? undefined : setGridIndex}
      />
      <Text className={globalStyles.gradientText} fontSize={"18px"} fontWeight={"700"}>
        You&apos;re throwing
      </Text>
      <Text className={styles.actionText}>
        {getPitchDescription(speed, getRowCol(gridIndex)[1], getRowCol(gridIndex)[0])}
      </Text>
      <Text fontSize={"18px"} fontWeight={"500"}>
        3. Generate randomness
      </Text>
      <RandomGenerator
        isActive={!nonce && !sessionStatus.didPitcherCommit}
        onChange={(value: string) => setNonce(value)}
      />
      {!sessionStatus.didPitcherCommit ? (
        <button
          className={globalStyles.commitButton}
          onClick={handleCommit}
          disabled={!nonce || sessionStatus.didPitcherCommit}
        >
          {commitPitch.isLoading ? <Spinner h={"14px"} w={"14px"} /> : <Text>Commit</Text>}
          {showTooltip && <div className={globalStyles.tooltip}>Choose where to pitch first</div>}
        </button>
      ) : (
        <Flex className={styles.completedAction}>Committed</Flex>
      )}
      {sessionStatus.didPitcherReveal || isRevealed ? (
        <Flex className={styles.completedAction}>Revealed</Flex>
      ) : (
        <button
          className={globalStyles.commitButton}
          onClick={handleReveal}
          disabled={sessionStatus.progress !== 4 || sessionStatus.didPitcherReveal}
        >
          {revealPitch.isLoading ? <Spinner h={"14px"} w={"14px"} /> : <Text>Reveal</Text>}
        </button>
      )}
      <Text className={styles.text}>
        Once both players have committed their moves, press{" "}
        <span className={styles.textBold}> Reveal</span> to see the outcome
      </Text>
    </Flex>
  );
};

export default PitcherView;
