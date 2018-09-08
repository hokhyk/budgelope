import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as moment from 'moment';

import { Transaction } from '../shared/transaction';
import { Account } from '../shared/account';
import { Budget } from '../shared/budget';
import { CategoryService } from '../categories/category.service';
import { AccountService } from '../accounts/account.service';
import { BudgetService } from '../budgets/budget.service';
import { FirebaseApp } from 'angularfire2';

@Injectable()
export class TransactionService {
  transactions: Transaction[];

  constructor(
    private db: AngularFirestore,
    private fb: FirebaseApp,
    private categoryService: CategoryService,
    private accountService: AccountService,
    private budgetService: BudgetService
  ) {}

  /**
   * Get all transactions with the id of the transactions
   * @param  budgetId Current active budget for the user id
   * @return          the observable for the transactions.
   */
  getTransactions(budgetId: string, accountId?: string): Observable<Transaction[]> {
    const transRef = '/budgets/' + budgetId + '/transactions';
    let collection = this.db.collection<Transaction>(transRef, ref => ref.orderBy('date', 'desc'));

    if (accountId) {
      collection = this.db.collection<Transaction>(transRef, ref =>
        ref.where('account.accountId', '==', accountId).orderBy('date', 'desc')
      );
    }

    return collection.snapshotChanges().pipe(
      map(actions =>
        actions.map(a => {
          const data = a.payload.doc.data() as Transaction;
          const id = a.payload.doc.id;
          // convert timestamp object from firebase to date object if object
          const dateObj = a.payload.doc.get('date');
          if (typeof dateObj === 'string') {
            data.date = new Date(dateObj);
          } else if (typeof dateObj === 'object') {
            data.date = dateObj.toDate();
          }

          data.account = {
            accountId: data['accountId'],
            accountName: data['accountName']
          };
          if (data['accountName']) {
            data.accountDisplayName = data['accountName'];
          }
          if (data.categories && data.categories.length > 1) {
            data.categoryDisplayName = 'Split (' + data.categories.length + ')';
          } else if (data.categories && data.categories.length === 1) {
            data.categoryDisplayName = data.categories[0].categoryName;
          }

          data.id = id;
          return { id, ...data };
        })
      )
    );
  }

  getTransaction(budgetId: string, transactionId: string): Observable<Transaction> {
    const transRef = 'budgets/' + budgetId + '/transactions/' + transactionId;
    return this.db.doc<Transaction>(transRef).valueChanges();
  }

  updateTransaction(budgetId: string, transactionParam: Transaction) {
    const docRef = this.db.doc('budgets/' + budgetId + '/transactions/' + transactionParam.id).ref;
    
    this.fb.firestore().runTransaction(dbTransaction => {
      return dbTransaction.get(docRef).then(
        readTransaction => {
          const transaction = readTransaction.data();

          dbTransaction.update(docRef, transaction);
        },
        error => {
          console.log(
            'There was an error updating the budget: ' +
              budgetId +
              ' - ' +
              transactionParam.id +
              ' - ' +
              transactionParam.amount,
            error
          );
        }
      );
    });
  }

  createStartingBalance(account: Account, budget: Budget) {}

  calculateAmount(transaction: Transaction): number {
    let amount = 0;
    transaction.categories.forEach(category => {
      const amountIn = +category.in,
        amountOut = +category.out;
      amount = amount + amountIn - amountOut;
    });

    return amount;
  }

  /**
   * Creates a new transaction and updates the relevant paths with the correct
   * data sets
   *
   * TODO: This needs to be modelled :P
   *
   * @param  {any}    transaction [description]
   * @param  {string} userId      [description]
   * @param  {string} budgetId    [description]
   * @return {[type]}             [description]
   */
  createTransaction(transaction: Transaction, budgetId: string) {
    const items = this.db.collection<Transaction>('budgets/' + budgetId + '/transactions'),
      shortDate = moment(transaction.date).format('YYYYMM');

    return new Promise((resolve, reject) => {
      items.add(transaction.toObject).then(
        response => {
          // after successfull response, we update the account budgets (could go to cloud functions)
          this.accountService.updateAccountBalance(
            transaction.account.accountId,
            budgetId,
            transaction.amount
          );

          // after successfull response, we update the category budgets (could go to cloud functions)
          transaction.categories.forEach(category => {
            this.categoryService.updateCategoryBudget(
              budgetId,
              category.categoryId,
              shortDate,
              category.in,
              category.out
            );
          });
          if (!transaction.transfer) {
            // after successfull response, we update the budget budgets (could go to cloud functions)
            this.budgetService.updateBudgetBalance(budgetId, transaction.date, transaction.amount);
          }
          resolve(response);
        },
        error => {
          reject(error);
        }
      );
    });
  }
}
