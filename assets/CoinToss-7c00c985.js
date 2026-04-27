import{a as p,j as t,T as r}from"./index-66b093f3.js";import{r as s}from"./vendor-react-8a332d8f.js";import"./vendor-utils-8290e097.js";import"./vendor-supabase-63fd4ddc.js";const j=({result:n,onComplete:l})=>{const[c,i]=s.useState(!1),[e,o]=s.useState(!1),{playSound:a}=p();s.useEffect(()=>{i(!0),a("coinFlip");const m=setTimeout(()=>{o(!0),a("buttonClick")},3e3);return()=>clearTimeout(m)},[]);const d=()=>{a("buttonClick"),l()},f=()=>{i(!1),o(!0)};return t.jsxs("div",{className:"fixed top-0 left-0 w-full h-full bg-black/80 flex flex-col items-center justify-center z-50 cursor-pointer",onClick:e?void 0:f,children:[t.jsxs("div",{className:"text-center",children:[t.jsx("h2",{className:"text-3xl font-bold mb-8 text-white",children:"Randomizing Tiebreaker"}),t.jsx("div",{className:"coin-flip-container",children:t.jsxs("div",{className:`coin ${c?"flipping":""} ${n===r.Titans?"flip-titans":"flip-atlanteans"}`,children:[t.jsxs("div",{className:"coin-face heads",children:[t.jsx("div",{className:"coin-emblem",children:"Titans"}),t.jsx("div",{className:"coin-shine"})]}),t.jsxs("div",{className:"coin-face tails",children:[t.jsx("div",{className:"coin-emblem",children:"Atlanteans"}),t.jsx("div",{className:"coin-shine"})]})]})}),t.jsx("div",{className:"text-2xl font-bold mt-8 text-white",children:n===r.Titans?"Titans go first!":"Atlanteans go first!"}),!e&&t.jsx("p",{className:"text-gray-400 text-sm mt-4",children:"Tap anywhere to skip"}),t.jsx("button",{className:`continue-button ${e?"visible":""}`,onClick:d,children:"Continue to Draft"})]}),t.jsx("style",{children:`
        .coin.flipping.flip-titans {
          animation: flipCoinTitans 3s ease-out forwards;
        }

        .coin.flipping.flip-atlanteans {
          animation: flipCoinAtlanteans 3s ease-out forwards;
        }

        .coin.flip-titans:not(.flipping) {
          transform: rotateY(0deg) rotateX(10deg);
        }

        .coin.flip-atlanteans:not(.flipping) {
          transform: rotateY(180deg) rotateX(10deg);
        }

        @keyframes flipCoinTitans {
          0% { transform: rotateY(0) rotateX(0); }
          20% { transform: rotateY(180deg) rotateX(10deg); }
          40% { transform: rotateY(360deg) rotateX(-10deg); }
          60% { transform: rotateY(540deg) rotateX(10deg); }
          80% { transform: rotateY(720deg) rotateX(-10deg); }
          100% { transform: rotateY(0deg) rotateX(10deg); }
        }

        @keyframes flipCoinAtlanteans {
          0% { transform: rotateY(0) rotateX(0); }
          20% { transform: rotateY(180deg) rotateX(10deg); }
          40% { transform: rotateY(360deg) rotateX(-10deg); }
          60% { transform: rotateY(540deg) rotateX(10deg); }
          80% { transform: rotateY(720deg) rotateX(-10deg); }
          100% { transform: rotateY(180deg) rotateX(10deg); }
        }
      `})]})};export{j as default};
