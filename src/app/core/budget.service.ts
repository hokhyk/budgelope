import { Injectable } from '@angular/core';
import * as firebase from 'firebase';
import * as moment from 'moment';
import { AngularFirestore } from 'angularfire2/firestore';
import 'rxjs/add/operator/take';

import { Budget } from '../shared/budget';
import { CategoryService } from './category.service';
import { AccountService } from './account.service'


@Injectable()
export class BudgetService {

  activeBudget: Budget;

  constructor(
    private db : AngularFirestore,
    private categoryService : CategoryService,
    private accountService : AccountService
  ) { }


  getActiveBudget(): Budget {
    if (null == this.activeBudget) {
      let currentUser = firebase.auth().currentUser;
      // get the activebudget from the user object
      let dbRef = firebase.database().ref('users/' + currentUser.uid + '/activeBudget');
      let tmpObj: any = {};

      dbRef.once('value').then((snapshot) => {
        let tmp: string[] = snapshot.val();
        let bRef = firebase.database().ref('budgets/' + tmp);

        bRef.once('value', (bSnap) => {
          tmpObj = bSnap.val();
          this.activeBudget = new Budget({
            "name" : tmpObj.name,
            "date" : new Date(),
            "active" : tmpObj.active,
            "test" : null,
            "id" : tmpObj.id
          });
        });
      });
    }
    return this.activeBudget;
  }

  createBudget(budget: Budget) {
    let dbRef = firebase.database().ref('budgets/' + budget.userId);
    let newBudget = dbRef.push();

    newBudget.set({
      name: budget.name,
      start: budget.start,
      active: budget.active,
      id: newBudget.key
    })
  }

  freshStart(currentBudgetId: string, userId: string) {
    // get current budget and store id
    let budgetStore  = this.db.collection('budgets'),
      cBudget: Budget,
      newBudget: Budget = new Budget();

      budgetStore.doc<Budget>(currentBudgetId).valueChanges().take(1).subscribe(t => {
        cBudget = t;
        let categoryService = this.categoryService,
            accountService = this.accountService;

        // create new budget
        cBudget.allocations = {};
        cBudget.balance = 0;
        delete(cBudget.id);



        budgetStore.add(cBudget).then(function(docRef) {
          // rename old budget
          t.name = t.name + ' - FRESH START '+ moment().format('YYYY-MM-DD hh:mm:ss');
          budgetStore.doc(currentBudgetId).update(t);

          // set user active budget
          // copy categories
          categoryService.copyCategories(currentBudgetId, docRef.id);
          accountService.copyAccounts(currentBudgetId, docRef.id);


          // copy accounts
          // copy payees

        });
      });



  }

}
