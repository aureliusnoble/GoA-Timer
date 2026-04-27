import{a as m,j as t,T as n}from"./index-06a7c7d1.js";import{r as a}from"./vendor-react-8a332d8f.js";import"./vendor-utils-8290e097.js";import"./vendor-supabase-63fd4ddc.js";const h=({result:s,onComplete:i})=>{const[o,r]=a.useState(!1),[l,d]=a.useState(!1),{playSound:e}=m();a.useEffect(()=>{r(!0),e("coinFlip");const f=setTimeout(()=>{d(!0),e("buttonClick")},3e3);return()=>clearTimeout(f)},[]);const c=()=>{e("buttonClick"),i()};return t.jsxs("div",{className:"fixed top-0 left-0 w-full h-full bg-black/80 flex flex-col items-center justify-center z-50",children:[t.jsxs("div",{className:"text-center",children:[t.jsx("h2",{className:"text-3xl font-bold mb-8 text-white",children:"Randomizing Tiebreaker"}),t.jsx("div",{className:"coin-flip-container",children:t.jsxs("div",{className:`coin ${o?"flipping":""} ${s===n.Titans?"flip-titans":"flip-atlanteans"}`,children:[t.jsxs("div",{className:"coin-face heads",children:[t.jsx("div",{className:"coin-emblem",children:"Titans"}),t.jsx("div",{className:"coin-shine"})]}),t.jsxs("div",{className:"coin-face tails",children:[t.jsx("div",{className:"coin-emblem",children:"Atlanteans"}),t.jsx("div",{className:"coin-shine"})]})]})}),t.jsx("div",{className:"text-2xl font-bold mt-8 text-white",children:s===n.Titans?"Titans go first!":"Atlanteans go first!"}),t.jsx("button",{className:`continue-button ${l?"visible":""}`,onClick:c,children:"Continue to Draft"})]}),t.jsx("style",{children:`
        .coin.flipping.flip-titans {
          animation: flipCoinTitans 3s ease-out forwards;
        }
        
        .coin.flipping.flip-atlanteans {
          animation: flipCoinAtlanteans 3s ease-out forwards;
        }
        
        @keyframes flipCoinTitans {
          0% { transform: rotateY(0) rotateX(0); }
          20% { transform: rotateY(180deg) rotateX(10deg); }
          40% { transform: rotateY(360deg) rotateX(-10deg); }
          60% { transform: rotateY(540deg) rotateX(10deg); }
          80% { transform: rotateY(720deg) rotateX(-10deg); }
          100% { transform: rotateY(0deg) rotateX(10deg); } /* End on Titans side (heads) */
        }
        
        @keyframes flipCoinAtlanteans {
          0% { transform: rotateY(0) rotateX(0); }
          20% { transform: rotateY(180deg) rotateX(10deg); }
          40% { transform: rotateY(360deg) rotateX(-10deg); }
          60% { transform: rotateY(540deg) rotateX(10deg); }
          80% { transform: rotateY(720deg) rotateX(-10deg); }
          100% { transform: rotateY(180deg) rotateX(10deg); } /* End on Atlanteans side (tails) */
        }
        
 
      `})]})};export{h as default};
