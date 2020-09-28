import closebutton from './closebutton';
import nextbutton from './nextbutton';
import previousbutton from './previousbutton';
import manualsyncbutton from './manualsyncbutton';
import minimizebutton from './minimizebutton';
import './forward30button';
import './replay10button';

export default (store) => {
  closebutton(store);
  nextbutton(store);
  previousbutton(store);
  manualsyncbutton(store);
  minimizebutton(store);
};
