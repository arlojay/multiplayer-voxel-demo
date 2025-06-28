import { KeyControl, MouseKey, controls } from "../../controls/controlsMap";
import { FormFieldInputType, UIButton, UIFieldset, UIFormField, UISection, UIText } from "../../ui";
import { $enum } from "ts-enum-util";
import { GameData } from "../gameData";

export function makeSettingsUI(gameData: GameData) {
    const root = new UIFieldset("Settings");
    
    root.onUpdate(() => {
        root.element.addEventListener("keydown", event => {
            if(event.key.toLowerCase() == "escape") {
                closeButton.click();
            }
        });
    })

    root.legend.style.fontSize = "2rem";
    root.legend.style.fontWeight = "bold";
    root.legend.style.textAlign = "center";

    interface SettingsOption<T> {
        name: string;
        type: "number" | "boolean";
        default: T;

        set(value: T): void;
        get(): T;

        min?: number;
        max?: number;
        step?: number;
    }

    const options: SettingsOption<any>[] = [
        {
            name: "View Distance",
            type: "number",
            default: 4,
            min: 1,
            max: 12,
            step: 1,
            set: (value: number) => gameData.clientOptions.viewDistance = value,
            get: () => gameData.clientOptions.viewDistance
        } as SettingsOption<number>,
        {
            name: "Invert Y",
            type: "boolean",
            default: false,
            set: (value: boolean) => gameData.clientOptions.controls.invertY = value,
            get: () => gameData.clientOptions.controls.invertY
        } as SettingsOption<boolean>,
        {
            name: "Warn Before Leave",
            type: "boolean",
            default: true,
            set: (value: boolean) => gameData.clientOptions.warnBeforeLeave = value,
            get: () => gameData.clientOptions.warnBeforeLeave
        } as SettingsOption<boolean>,
        {
            name: "Max FPS",
            type: "number",
            default: 60,
            min: 5,
            max: 300,
            step: 5,
            set: (value: number) => gameData.clientOptions.maxFPS = value,
            get: () => gameData.clientOptions.maxFPS
        } as SettingsOption<number>,
        {
            name: "Budget Update Time",
            type: "number",
            default: 15,
            min: 0.2,
            max: 30,
            step: 0.2,
            set: (value: number) => gameData.clientOptions.budgetUpdateTime = value,
            get: () => gameData.clientOptions.budgetUpdateTime
        } as SettingsOption<number>,
        {
            name: "Background screenshots",
            type: "boolean",
            default: true,
            set: (value: boolean) => gameData.clientOptions.backgroundScreenshots = value,
            get: () => gameData.clientOptions.backgroundScreenshots
        } as SettingsOption<boolean>,
    ];

    for(const option of options) {
        const element = new UISection;

        if(option.type == "number") {
            if("min" in option || "max" in option) {
                const slider = new UIFormField(FormFieldInputType.SLIDER, option.name, option.get());
                slider.min = option.min ?? 0;
                slider.max = option.max ?? 1000;
                slider.step = option.step ?? 1;
                slider.displayValue = true;
                
                slider.onChange(() => {
                    option.set(slider.value);
                    gameData.saveClientOptions();
                });

                element.addChild(slider);
            } else {
                const number = new UIFormField(FormFieldInputType.NUMBER, option.name, option.get().toString());
                number.displayValue = true;

                number.placeholder = option.default.toString();
                number.onChange(() => {
                    option.set(+number.value);
                    gameData.saveClientOptions();
                });

                element.addChild(number);
            }
        } else if(option.type == "boolean") {
            const checkbox = new UIFormField(FormFieldInputType.CHECKBOX, option.name);
            checkbox.displayValue = true;
            checkbox.checked = option.get();

            checkbox.onChange(() => {
                option.set(checkbox.checked);
                gameData.saveClientOptions();
            });

            element.addChild(checkbox);
        }

        root.addChild(element);
    }
    
    const makeControlElement = (binding: KeyControl) => {
        const element = new UISection;
        element.style.display = "grid";
        element.style.gridTemplateColumns = "1fr repeat(2, max-content)";

        const name = new UIText(binding.name);
        element.addChild(name);

        const resetKeybindButton = new UIButton();
        resetKeybindButton.onClick(() => {
            binding.reset();
            updateAll();
        });
        element.addChild(resetKeybindButton);

        const changeKeybindButton = new UIButton();
        changeKeybindButton.onUpdate(() => {
            changeKeybindButton.element.addEventListener("contextmenu", event => event.preventDefault());
            changeKeybindButton.element.addEventListener("mouseup", event => event.preventDefault());
        });
        changeKeybindButton.onClick(async () => {
            await changeKeybindButton.setText("<Press>");

            changeKeybindButton.element.tabIndex = 0;
            changeKeybindButton.element.focus();
            changeKeybindButton.element.requestPointerLock();
            
            changeKeybindButton.element.addEventListener("keydown", event => {
                event.preventDefault();
                binding.set(event.key);
                document.exitPointerLock();
                gameData.saveClientOptions();
                updateAll();
            });
            changeKeybindButton.element.addEventListener("mousedown", event => {
                event.preventDefault();
                const mouseButton = $enum(MouseKey).asValueOrThrow("mouse" + event.button);
                
                binding.set(mouseButton);
                document.exitPointerLock();
                gameData.saveClientOptions();
                updateAll();
            });
            changeKeybindButton.element.addEventListener("focusout", () => {
                updateAll();
            })
        })
        element.addChild(changeKeybindButton);

        const updateAll = () => {
            changeKeybindButton.text = binding.mapping.toUpperCase();

            resetKeybindButton.text = "Reset (" + binding.defaultKey.toUpperCase() + ")";
            resetKeybindButton.visible = !binding.isDefault();
            
            element.update();
        }
        updateAll();

        return element;
    }

    const makeControlCategory = (name: string, ...controls: KeyControl[]) => {
        const category = new UISection;
        category.style.marginBottom = "1rem";

        const element = new UIText(name);
        element.style.display = "block";
        element.style.width = "100%";
        element.style.textAlign = "center";
        element.style.fontWeight = "bold";

        category.addChild(element);
        for(const control of controls) category.addChild(makeControlElement(control));

        return category;
    }
    

    const keybindsSection = new UIFieldset("Keybinds");
    keybindsSection.style.margin = "1rem 0";
    keybindsSection.legend.style.textAlign = "center";

    keybindsSection.addChild(makeControlCategory(
        "MOVEMENT",
        controls.FORWARD,
        controls.BACKWARD,
        controls.STRAFE_LEFT,
        controls.STRAFE_RIGHT,
        controls.JUMP
    ));
    
    keybindsSection.addChild(makeControlCategory(
        "MODIFIERS",
        controls.RUN,
        controls.CROUCH
    ));
    
    keybindsSection.addChild(makeControlCategory(
        "WORLD",
        controls.PLACE_BLOCK,
        controls.BREAK_BLOCK,
        controls.INTERACT_BLOCK
    ));

    keybindsSection.addChild(makeControlCategory(
        "FREECAM",
        controls.FREECAM,
        controls.FREECAM_DOWN,
        controls.FREECAM_UP
    ));

    keybindsSection.elements[keybindsSection.elements.length - 1].style.marginBottom = "";

    root.addChild(keybindsSection);

    const closeButton = new UIButton("Close");
    closeButton.onClick(() => {
        root.visible = false;
        root.update();
    })
    root.addChild(closeButton);

    return root;
}