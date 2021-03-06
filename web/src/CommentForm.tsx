import { Button, TextInput } from "@primer/components";
import { PaperAirplaneIcon } from "@primer/octicons-react";
import React from "react";

const CommentForm: React.FC<{
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  inputRef: any;
  onSubmit: () => any;
  disabled: boolean;
  placeholder: string;
}> = ({ message, setMessage, inputRef, onSubmit, disabled, placeholder }) => {
  return (
    <form
      onSubmit={(event) => {
        // Note that when the button is disabled, hitting enter and clicking on the button do not hit this callback.
        // That's safe for us. If we get here, then we really should be hitting the callback.
        if (message.trim().length > 0) {
          onSubmit();
        }

        // So that the browser doesn't refresh.
        event.preventDefault();
      }}
    >
      {/* TODO: flex grow this stuff instead of hard-coding the width. */}
      <TextInput
        placeholder={placeholder}
        variant="small"
        marginRight={1}
        width={"174px"}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        ref={inputRef}
      ></TextInput>
      <Button
        disabled={message.trim().length === 0 || disabled}
        // This fixes the button height.
        style={{ lineHeight: "initial" }}
      >
        <PaperAirplaneIcon size={16}></PaperAirplaneIcon>
      </Button>
    </form>
  );
};

export default CommentForm;
