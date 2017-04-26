import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';
import * as firebase from 'firebase';

@Injectable()
export class UserService implements CanActivate {
  userLoggedIn: boolean = false;
  loggedInUser: string;
  authUser: any;


  constructor(private router: Router) {
    var config = {
      apiKey: "AIzaSyAJnyoZbx_6KPUiW6vaOzcmVHY1KoTtYoA",
      authDomain: "yrab-6c2b5.firebaseapp.com",
      databaseURL: "https://yrab-6c2b5.firebaseio.com",
      projectId: "yrab-6c2b5",
      storageBucket: "yrab-6c2b5.appspot.com",
      messagingSenderId: "387753491485"
    };
    firebase.initializeApp(config);
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    let url: string = state.url;
    return this.verifyLogin(url);
  }

  verifyLogin(url: string): boolean {
    if (this.userLoggedIn) { return true; }

    this.router.navigate(['/login']);
    return false;
  }

  register(email: string, password: string){
    firebase.auth().createUserWithEmailAndPassword(email, password)
      .catch(function(error){
        alert(`${error.message} Please try again!`);
      });
  }

  verifyUser() {
    this.authUser = firebase.auth().currentUser;

    if (this.authUser){
      alert(`Welcome ${this.authUser.email}`);
      this.loggedInUser = this.authUser.email;
      this.userLoggedIn = true;
      this.router.navigate(['/']);
    }
  }

  login(loginEmail: string, loginPassword: string) {
    firebase.auth().signInWithEmailAndPassword(loginEmail, loginPassword)
      .catch(function(error){
        alert(`${error.message} Unable to login. Try again.`);
      })
  }

  logout(){
    this.userLoggedIn = false;
    firebase.auth().signOut().then(function(){
      alert(`Logged out!`);
    }, function(error){
      alert(`${error.message} Unable to logout. Try again!`);
    });
  }

}