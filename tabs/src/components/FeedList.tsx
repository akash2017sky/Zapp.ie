/// <reference path="../types/global.d.ts" />

import { FunctionComponent, useEffect } from 'react';
import styles from './FeedList.module.css';
import React, { useState } from 'react';
import { getWallets, getPaymentsSince } from '../services/lnbitsServiceLocal';

interface FeedListProps {
  timestamp?: number | null;
}

const FeedList: React.FC<FeedListProps> = ({ timestamp }) => {
  const [zaps, setZaps] = useState<Zap[]>([]);

  // Calculate the timestamp for 7 days ago
  console.log('Date.now(): ', Date.now());
  const sevenDaysAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;

  // Use the provided timestamp or default to 7 days ago
  const paymentsSinceTimestamp =
    timestamp === null || timestamp === undefined || timestamp === 0
      ? sevenDaysAgo
      : timestamp;

  console.log('Fetching payments since: ', paymentsSinceTimestamp);

  const fetchZaps = async () => {
    console.log('Fetching transactions ...');
    const wallets = await getWallets('Receiving'); // We'll just look at the receiving wallets.
    let allZaps: Zap[] = [];

    // Loop through all the wallets
    if (wallets) {
      for (const wallet of wallets) {
        console.log('Wallet name: ', wallet.name);
        console.log('Wallet inkey: ', wallet.inkey);
        const payments = await getPaymentsSince(
          wallet.inkey,
          paymentsSinceTimestamp,
        );
        console.log('Payments: ', payments.length);

        for (const payment of payments) {
          const zap: Zap = {
            id: payment.checking_id,
            bolt11: payment.bolt11,
            from: null,
            to: null,
            memo: payment.memo,
            amount: payment.amount / 1000,
            wallet_id: payment.wallet_id,
            time: payment.time,
          };

          if (payment.extra?.from) {
            const fromWallets = await getWallets(payment.extra.from, undefined);
            zap.from =
              fromWallets && fromWallets.length === 1 ? fromWallets[0] : null;
          }

          if (payment.extra?.to) {
            const toWallets = await getWallets(payment.extra.to, undefined);
            zap.to = toWallets && toWallets.length === 1 ? toWallets[0] : null;
          }

          allZaps.push(zap);
        }
      }
    }
    console.log('All Zaps: ', allZaps);
    //setZaps(zaps);
    setZaps(prevState => [...prevState, ...allZaps]);
  };

  useEffect(() => {
    // Clear the zaps
    setZaps([]);
    fetchZaps();
  }, [timestamp]);

  return (
    <div className={styles.feedlist}>
      <div className={styles.headercell}>
        <div className={styles.headerContents}>
          <b className={styles.string}>From</b>
          <b className={styles.string}>To</b>
          <b className={styles.string2}>Memo</b>
          <div className={styles.stringWrapper}>
            <b className={styles.string3}>Zap amount</b>
          </div>
          <div className={styles.buttonsStack}>
            <div className={styles.iconbutton}>
              <div className={styles.base}>
                <div className={styles.buttonsStack}>
                  <img
                    className={styles.iconContent}
                    alt=""
                    src="Icon-content.svg"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {zaps?.map((zap, index) => (
        <div key={zap.id || index} className={styles.bodycell}>
          <div className={styles.bodyContents}>
            <div className={styles.mainContentStack}>
              <div className={styles.personDetails}>
                <img
                  className={styles.avatarIcon}
                  alt=""
                  src="avatar.png"
                  style={{ display: 'none' }}
                />
                <div className={styles.userName}>{zap.from?.name}</div>
              </div>
              <div className={styles.personDetails}>
                <img
                  className={styles.avatarIcon}
                  alt=""
                  src="avatar.png"
                  style={{ display: 'none' }}
                />
                <div className={styles.userName}>{zap.to?.name}</div>
              </div>
              <div className={styles.userName}>{zap.memo}</div>
            </div>
            <div className={styles.transactionDetails}>
              <b className={styles.b}>{zap.amount}</b>
              <img
                className={styles.icon}
                alt=""
                src="Icon.svg"
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FeedList;