import { useCallback, useState, useEffect } from "react";
import LiveCursor from "./cursor/LiveCursor"
import { useBroadcastEvent, useEventListener, useMyPresence, useOthers } from "@/liveblocks.config"
import { CursorMode, CursorState, Reaction, ReactionEvent } from "@/types/type";
import CursorChat from "./cursor/CursorChat";
import ReactionSelector from "./reaction/ReactionButton";
import FlyingReaction from "./reaction/FlyingReaction";
import useInterval from "@/hooks/useInterval";

type Props = {
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
    undo: () => void;
    redo: () => void;
  };

const Live = ({ canvasRef, undo, redo }: Props) => {

    // useOthers returns the list of other users in the room.
    const others = useOthers();
  
    //useMyPresence returns the presence of the current user in the room.
    //It also returns a function to update the presence of the current user.
  
    const [{ cursor }, updateMyPresence] = useMyPresence() as any;
 
    // store the reactions created on mouse click
    const [reactions, setReactions] = useState<Reaction[]>([]);

    const broadcast = useBroadcastEvent();
  
    // track the state of the cursor (hidden, chat, reaction, reaction selector)
    const [cursorState, setCursorState] = useState<CursorState>({
      mode: CursorMode.Hidden,
    });
  
    // set the reaction of the cursor
    const setReaction = useCallback((reaction: string) => {
      setCursorState({ mode: CursorMode.Reaction, reaction, isPressed: false });
    }, []);
  
    // Remove reactions that are not visible anymore (every 1 sec)
    useInterval(() => {
      setReactions((reactions) => reactions.filter((reaction) => reaction.timestamp > Date.now() - 4000));
    }, 1000);
  
  
   
    // Listen to keyboard events to change the cursor state
    useEffect(() => {
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.key === "/") {
          setCursorState({
            mode: CursorMode.Chat,
            previousMessage: null,
            message: "",
          });
        } else if (e.key === "Escape") {
          updateMyPresence({ message: "" });
          setCursorState({ mode: CursorMode.Hidden });
        } else if (e.key === "e") {
          setCursorState({ mode: CursorMode.ReactionSelector });
        }
      };
  
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "/") {
          e.preventDefault();
        }
      };
  
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("keydown", onKeyDown);
  
      return () => {
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("keydown", onKeyDown);
      };
    }, [updateMyPresence]);
    // Broadcast the reaction to other users (every 100ms)
    useInterval(() => {
        if (cursorState.mode === CursorMode.Reaction && cursorState.isPressed && cursor) {
          // concat all the reactions created on mouse click
          setReactions((reactions) =>
            reactions.concat([
              {
                point: { x: cursor.x, y: cursor.y },
                value: cursorState.reaction,
                timestamp: Date.now(),
              },
            ])
          );

          //pair with useEventListener to broadcast
          broadcast({
            x: cursor.x,
            y: cursor.y,
            value: cursorState.reaction
          })
    
        }
    }, 100);

    //fire everytime event is broadcasted
    useEventListener((eventData)=>{
        const event = eventData.event as ReactionEvent;

        //replicate event for other user. Taken from useInterval()
        setReactions((reactions) =>
            reactions.concat([
                {
                point: { x: event.x, y: event.y }, //instead of cursor.x
                value: event.value, //instead of cursorState.reaction
                timestamp: Date.now(),
                },
            ])
            );

    })
  
    // Listen to mouse events to change the cursor state
    const handlePointerMove = useCallback((event: React.PointerEvent) => {
      event.preventDefault();
  
      // if cursor is not in reaction selector mode, update the cursor position
      if (cursor == null || cursorState.mode !== CursorMode.ReactionSelector) {
        // get the cursor position in the canvas
        const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
        const y = event.clientY - event.currentTarget.getBoundingClientRect().y;
  
        // broadcast the cursor position to other users
        updateMyPresence({
          cursor: {
            x,
            y,
          },
        });
      }
    }, []);
  
    // Hide the cursor when the mouse leaves the canvas
    const handlePointerLeave = useCallback(() => {
      setCursorState({
        mode: CursorMode.Hidden,
      });
      updateMyPresence({
        cursor: null,
        message: null,
      });
    }, []);
  
    // Show the cursor when the mouse enters the canvas
    const handlePointerDown = useCallback(
      (event: React.PointerEvent) => {
        // get the cursor position in the canvas
        const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
        const y = event.clientY - event.currentTarget.getBoundingClientRect().y;
  
        updateMyPresence({
          cursor: {
            x,
            y,
          },
        });
  
        // if cursor is in reaction mode, set isPressed to true
        setCursorState((state: CursorState) =>
          cursorState.mode === CursorMode.Reaction ? { ...state, isPressed: true } : state
        );
      },
      [cursorState.mode, setCursorState]
    );
  
    // hide the cursor when the mouse is up
    const handlePointerUp = useCallback(() => {
      setCursorState((state: CursorState) =>
        cursorState.mode === CursorMode.Reaction ? { ...state, isPressed: false } : state
      );
    }, [cursorState.mode, setCursorState]);
  
    // trigger respective actions when the user clicks on the right menu
   
  
    return (
        <div className="h-[100vh] w-full flex justify-center item-center text-center border-2 border-green-500" 
        onPointerDown={handlePointerDown} 
        onPointerLeave={handlePointerLeave} 
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}>

        <h1 className="font-2xl text-white">Fima Clone</h1>

        {/* {render reaction} */}
        {reactions.map((r) => (
            <FlyingReaction 
                key={r.timestamp.toString()}
                x={r.point.x}
                y={r.point.y}
                timestamp={r.timestamp}
                value={r.value}
            />
        ))}

        {cursor && (<CursorChat cursor ={cursor} cursorState = {cursorState} setCursorState = {setCursorState} updateMyPresence = {updateMyPresence}/>)}

        {cursorState.mode === CursorMode.ReactionSelector && (
            <ReactionSelector 
                setReaction={(reaction) => setReaction(reaction)}
            />
        )}

        <LiveCursor others = {others}/>
    </div>
    );
  };
  
  export default Live;
