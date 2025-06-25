import { UIButton, UIEvent, UISection, UIText } from "../../ui";
import { GameData, ServerDescriptor } from "../gameData";

function formatDateRelative(date: Date) {
    const dateFormatter = new Intl.RelativeTimeFormat();

    const timePassed = (Date.now() - date.getTime()) / 1000;
    if(timePassed < 60) return dateFormatter.format(-Math.floor(timePassed), "second");
    else if(timePassed < 60 * 60) return dateFormatter.format(-Math.floor(timePassed / 60), "minute");
    else if(timePassed < 60 * 60 * 24) return dateFormatter.format(-Math.floor(timePassed / 60 / 60), "hour");
    else return dateFormatter.format(-Math.floor(timePassed / 60 / 60 / 24), "day");
}

export function makeServerListUI(gameData: GameData) {
    const root = new UISection;
    root.style.textAlign = "left";
    root.style.margin = "1rem 0";

    const head = new UISection;
    head.style.display = "grid";
    head.style.gridTemplateColumns = "10rem 8rem";
    head.style.width = "100%";
    head.style.marginBottom = "1rem";

    const nameCategory = new UIText("Name");
    nameCategory.style.fontWeight = "bold";
    head.addChild(nameCategory);

    const timeCreatedCategory = new UIText("Time Created");
    timeCreatedCategory.style = nameCategory.style;
    head.addChild(timeCreatedCategory);


    root.addChild(head);

    const body = new UISection;
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "0.5rem";

    const servers = Array.from(gameData.servers.values());
    servers.sort((a, b) => b.lastPlayed.getTime() - a.lastPlayed.getTime());
    for(const server of servers) {
        const card = makeServerCard(server);
        body.addChild(card);
    }

    root.addChild(body);

    return root;
}

export function makeServerCard(server: ServerDescriptor) {
    const cardElement = new UISection;
    cardElement.style.display = "grid";
    cardElement.style.gridTemplateColumns = "10rem 8rem max-content";
    cardElement.style.justifyContent = "center";
    cardElement.style.width = "100%";

    cardElement.addChild(new UIText(server.name));

    const timeCreatedElement = new UIText(formatDateRelative(server.dateCreated));
    cardElement.addChild(timeCreatedElement);

    const updateInterval = setInterval(() => {
        timeCreatedElement.setText(formatDateRelative(server.dateCreated));
    }, 1000);
    cardElement.onDestroyed(() => {
        clearInterval(updateInterval);
    })

    const buttons = new UISection;

    const playButton = new UIButton("Play");
    playButton.onClick(() => {
        cardElement.bubbleEvent(new UIEvent("server-play", playButton, { server }));
    });
    buttons.addChild(playButton);
    
    const editButton = new UIButton("Edit");
    editButton.onClick(() => {
        cardElement.bubbleEvent(new UIEvent("server-edit", editButton, { server }));
    });
    buttons.addChild(editButton);
    
    const cloneButton = new UIButton("Clone");
    cloneButton.onClick(() => {
        cardElement.bubbleEvent(new UIEvent("server-clone", cloneButton, { server }));
    });
    buttons.addChild(cloneButton);
    
    const deleteButton = new UIButton("Delete");
    deleteButton.onClick(() => {
        cardElement.bubbleEvent(new UIEvent("server-delete", deleteButton, { server }));
    });
    buttons.addChild(deleteButton);

    cardElement.addChild(buttons);
    return cardElement;
}