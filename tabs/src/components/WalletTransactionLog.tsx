import React, { useEffect, useState } from 'react';
import styles from './WalletTransactionLog.module.css';
import {
  getUsers,
  getWalletTransactionsSince,
} from '../services/lnbitsServiceLocal';
import ArrowIncoming from '../images/ArrowIncoming.svg';
import ArrowOutgoing from '../images/ArrowOutcoming.svg';
import moment from 'moment';
import { useMsal } from '@azure/msal-react';

interface WalletTransactionLogProps {
  activeTab?: string;
  activeWallet?: string;
  filterZaps?: (activeTab: string) => void;
}

const adminKey = process.env.REACT_APP_LNBITS_ADMINKEY as string;

const WalletTransactionLog: React.FC<WalletTransactionLogProps> = ({
  activeTab,
  activeWallet,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate the timestamp for 30 days ago
  const sevenDaysAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;

  // Use the provided timestamp or default to 7 days ago
  const paymentsSinceTimestamp = sevenDaysAgo;
  const activeTabForData =
    activeTab === null || activeTab === undefined || activeTab === ''
      ? 'all'
      : activeTab;
  console.log('activeTabForData: ', activeTabForData);

  console.log('activeWallet: ', activeWallet);

  const getAllUsers = async () => {
    const users = await getUsers(adminKey, {});
    if (users) {
      setUsers(users);
    }
    console.log('Users: ', users);
  };

  const { accounts } = useMsal();
  const account = accounts[0];

  const fetchTransactions = async () => {
    console.log('Fetching payments since: ', paymentsSinceTimestamp);
    setLoading(true);
    setError(null);

    let allTransactions: Transaction[] = [];

    try {
      const currentUserLNbitDetails = await getUsers(adminKey, {
        aadObjectId: account.localAccountId,
      });

      console.log('Current user: ', currentUserLNbitDetails);

      if (currentUserLNbitDetails && currentUserLNbitDetails.length > 0) {
        let inkey: any = null;

        if (activeWallet === 'Private') {
          inkey = currentUserLNbitDetails[0].privateWallet?.inkey;
        } else {
          inkey = currentUserLNbitDetails[0].allowanceWallet?.inkey;
        }

        if (inkey) {
          const transactions = await getWalletTransactionsSince(
            inkey,
            paymentsSinceTimestamp,
            null, //{ tag: 'zap' }
          );

          let filteredTransactions: any = null;

          console.log('Transactions AKASH: ', transactions);

          if (activeTab === 'sent')
            filteredTransactions = transactions.filter(f => f.amount < 0);
          else if (activeTab === 'received')
            filteredTransactions = transactions.filter(f => f.amount > 0);
          else filteredTransactions = transactions;

          for (const transaction of filteredTransactions) {
            transaction.extra.from = users.filter(
              u => u.id === transaction.extra?.from?.user,
            )[0];
            transaction.extra.to = users.filter(
              u => u.id === transaction.extra?.to?.user,
            )[0];
          }

          allTransactions = allTransactions.concat(filteredTransactions);
          console.log('Transactions: ', allTransactions);
        }
      }
      setTransactions(prevState => [...prevState, ...allTransactions]);
    } catch (error) {
      if (error instanceof Error) {
        setError(`Failed to fetch transactions: ${error.message}`);
      } else {
        setError('An unknown error occurred while fetching transactions');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTransactions([]);
    getAllUsers();
    fetchTransactions();
  }, [activeTab, activeWallet]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className={styles.feedlist}>
      {transactions
        ?.sort((a, b) => b.time - a.time)
        .map((transaction, index) => (
          <div
            key={transaction.checking_id || index}
            className={styles.bodycell}
          >
            <div className={styles.bodyContents}>
              <div className={styles.mainContentStack}>
                <img
                  className={styles.avatarIcon}
                  alt=""
                  src={
                    (transaction.amount as number) < 0
                      ? ArrowOutgoing
                      : ArrowIncoming
                  }
                />

                <div className={styles.userName}>
                  <p className={styles.lightHelightInItems}>
                    {' '}
                    <b>
                      {transaction.extra?.tag === 'zap'
                        ? 'Zap!'
                        : transaction.extra?.tag ?? 'Regular transaction'}
                    </b>
                  </p>
                  <div className={styles.lightHelightInItems}>
                    {' '}
                    {moment(moment.now()).diff(
                      transaction.time * 1000,
                      'days',
                    )}{' '}
                    days ago{' '}
                    {(transaction.amount as number) < 0 ? 'to' : 'from'}{' '}
                    <b>
                      {(transaction.amount as number) < 0
                        ? transaction.extra?.to?.displayName ?? 'Unknown'
                        : transaction.extra?.from?.displayName ??
                          'Unknown'}{' '}
                    </b>
                  </div>
                  <p className={styles.lightHelightInItems}>
                    {transaction.memo}
                  </p>
                </div>
              </div>
              <div
                className={styles.transactionDetailsAllowance}
                style={{
                  color:
                    (transaction.amount as number) < 0 ? '#E75858' : '#00A14B',
                }}
              >
                <div className={styles.lightHelightInItems}>
                  {' '}
                  <b className={styles.b}>
                    {transaction.amount < 0
                      ? transaction.amount / 1000
                      : '+' + transaction.amount / 1000}
                  </b>{' '}
                  Sats{' '}
                </div>
                <div
                  style={{ display: 'none' }}
                  className={styles.lightHelightInItems}
                >
                  {' '}
                  about $0.11{' '}
                </div>
              </div>
            </div>
          </div>
        ))}
      {transactions.length === 0 && <div>No transactions to show.</div>}
    </div>
  );
};

export default WalletTransactionLog;