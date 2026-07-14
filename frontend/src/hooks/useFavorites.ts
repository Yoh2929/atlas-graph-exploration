import {
 addFavorite,
 removeFavorite,
 listFavorites
} from "../api/favorites.api";

import { useState } from "react";


export function useFavorites(nodeId:string,user:boolean){


const [favorite,setFavorite]=useState(false);



async function toggle(){

 if(!user)return;


 if(favorite){

  await removeFavorite(nodeId);
  setFavorite(false);

 }
 else {

  await addFavorite(nodeId);
  setFavorite(true);

 }

}



async function load(){

 if(!user)return;


 const favs = await listFavorites();

 setFavorite(
   favs.some(
    f=>f.node_id===nodeId
   )
 );

}



return {
 favorite,
 toggle,
 load
};


}