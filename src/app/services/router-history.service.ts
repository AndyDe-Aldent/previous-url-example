import { Injectable } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, scan } from 'rxjs/operators';
import { RouterHistory } from '../shared/breadcrumbs/router-history';
import { MenuItem } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class RouterHistoryService {
  static readonly ROUTE_DATA_BREADCRUMB = 'breadcrumb';
  history$: MenuItem[] = [];
  clearHistory: boolean = false;

  constructor(router: Router, private activatedRoute: ActivatedRoute) {
    router.events
      .pipe(
        // only include NavigationStart and NavigationEnd events
        filter(
          event =>
            event instanceof NavigationStart || event instanceof NavigationEnd
        ),
        scan<NavigationStart | NavigationEnd, RouterHistory>(
          (acc, event) => {

            if (event instanceof NavigationStart) {
              // We need to track the trigger, id, and idToRestore from the NavigationStart events
              return {
                ...acc,
                event,
                trigger: event.navigationTrigger,
                id: event.id,
                idToRestore:
                  (event.restoredState && event.restoredState.navigationId) ||
                  undefined
              };
            }

            const children: ActivatedRoute[] = this.activatedRoute.root.children;

            var currentChild = children[0];
            const label = this.getRouteLabel(currentChild);

            // NavigationEnd events
            const history = [...acc.history];
            let currentIndex = acc.currentIndex;

            if(this.clearHistory){
              history.splice(0);
              this.clearHistory = false;
            }

            var existingIndex = history.findIndex(h => h.label == label);

            if(existingIndex != -1){
              history.splice(existingIndex + 1);
            }else if (acc.trigger === 'imperative') {
              // remove all events in history that come after the current index
              history.splice(currentIndex + 1);

              var urlComponants = event.urlAfterRedirects.split('?');
              // add the new event to the end of the history and set that as our current index
              history.push({ id: acc.id, url: urlComponants[0], label: label, queryParameters: urlComponants[1] });

              currentIndex = history.length - 1;
            }else if (acc.trigger === 'popstate') {
              // get the history item that references the idToRestore
              const idx = history.findIndex(x => x.id === acc.idToRestore);

              // if found, set the current index to that history item and update the id
              if (idx > -1) {
                currentIndex = idx;
                history[idx].id = acc.id;
              } else {
                currentIndex = 0;
              }
            }

            return {
              ...acc,
              event,
              history,
              currentIndex
            };
          },
          {
            event: null,
            history: [],
            trigger: null,
            id: 0,
            idToRestore: 0,
            currentIndex: 0
          }
        ),
        // filter out so we only act when navigation is done
        filter(
          ({ event, trigger }) => event instanceof NavigationEnd && !!trigger
        )
      )
      .subscribe(({ history }) => {
        this.history$ = [];
        history.forEach(element => {

          if(element.queryParameters){ // check if the element has query parameters and save them into the history if it does
            var params= [];

            element.queryParameters.split("&").forEach(param => {
              var componants = param.split("=");

              params.push({k: componants[0], v: componants[1]})
            });

            this.history$.push({label: element.label, target: element.url, queryParams: params})
          }
          else{
            this.history$.push({label: element.label, target: element.url})
          }
        });
      });
  }

  // Lets the history be cleared if the user goes to a high level menu item or similar
  // which may not be in the current history
  public clear(){
    this.clearHistory = true;
  }
  
  // reads the label from the active route for use in the breadcrumb
  private getRouteLabel(route: ActivatedRoute): string{

    if (route.children.length === 0) {
      return route.snapshot.data[RouterHistoryService.ROUTE_DATA_BREADCRUMB];;
    }

    return this.getRouteLabel(route.children[0]);
  }
}
