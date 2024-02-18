local mod = RegisterMod("SpindownHelper", 1)

local showText = false

local font = Font()
font:Load("font/pftempestasevencondensed.fnt")
local colors ={
    ["no"] = KColor(200/255, 0/255, 0/255,1),
    ["5"] = KColor(0/255, 255/255, 0/255,1),
    ["25"] = KColor(128/255, 235/255, 0/255,1),
    ["50"] = KColor(182/255, 255/255, 0/255,1),
    ["100"] = KColor(255/255, 182/255, 0/255,1),
    [">100"] = KColor(255/255, 128/255, 0/255,1)
}

function splitString(inputstr, sep)
    local t = {}
    for str in string.gmatch(inputstr, "([^" .. sep .. "]+)") do
        table.insert(t, str)
    end
    return t
end

local file = io.open("mods\\spindown-helper\\resources\\dict.txt", "r")
local dict = {}
if file then
    for line in file:lines() do
        local split = splitString(line, ",")
        local game_id = 0
        local my_id = 0
        for i, v in ipairs(split) do
            if i == 2 then
               game_id = tonumber(v)
            elseif i == 3 then
               my_id = tonumber(v)
           end
        end
       dict[game_id] = my_id
    end
    file:close()
end

-- create dict-reverse
local dict_reverse = {}
for k, v in pairs(dict) do
    dict_reverse[v] = k
end

local function getSpins(from_id, to_id, car_battery_bool)
    from_id = dict[from_id]
    if not from_id then
        return "", colors["no"]
    end
    local steps = from_id - to_id

    if steps < 0 then
        return "NO", colors["no"]
    end
    local dads_note_id = 656
    local dn_steps = from_id - dads_note_id
    if(from_id >= dads_note_id and to_id <= dads_note_id and (not car_battery_bool or dn_steps % 2 == 0)) then
        return "DN", colors["no"]
    end
    if(car_battery_bool and steps % 2 == 1) then
        return "CB", colors["no"]
    end
    if(car_battery_bool and steps % 2 == 0) then
        steps = steps/2
    end
    local returned_color = colors["no"]

    if steps >= 100 then
        returned_color = colors[">100"]
    elseif steps >= 50 then
        returned_color = colors["100"]
    elseif steps >= 25 then
        returned_color = colors["50"]
    elseif steps >= 5 then
        returned_color = colors["25"]
    else
        returned_color = colors["5"]
    end

    return math.floor(steps), returned_color
end

local function printText()
    if not showText then
        return
    end
    local file_id = io.open("mods\\spindown-helper\\resources\\selected_id.txt", "r")
    local looking_for_id = 0
    if file_id then
        looking_for_id = tonumber(file_id:read("*a"))
        file_id:close()
    end
    local show_id = dict_reverse[looking_for_id]
    local file = io.open("mods\\spindown-helper\\resources\\selected.txt", "r")
    if file then
        local text = file:read("*a")
        file:close()

        -- GESTIONE SPRITE
        local itemSprite = Sprite();
        local itemConfig = Isaac.GetItemConfig():GetCollectible(show_id)
        local descriptor = itemConfig.GfxFileName
        itemSprite:Load("gfx/005.100_Collectible.anm2", true)
        itemSprite:ReplaceSpritesheet(1, descriptor )
        itemSprite:LoadGraphics()
        itemSprite.Color = Color(1,1,1,1)
        itemSprite:SetFrame("Idle", 8)
        itemSprite.Scale = Vector(0.5, 0.5)
        local OFFSET = 17
        local Y = 201
        itemSprite:Render(Vector(8, Y + OFFSET))

        -- GESTIONE TESTO
        font:DrawStringScaled(text, 15, Y, 0.5, 0.5, KColor(255/255, 255/255, 255/255,0.5), 0, true)
    end



    local player = Isaac.GetPlayer(0)
    local cb = false
    if player:HasCollectible(356) then
        cb = true
    end

    

    local entities = Isaac.GetRoomEntities()
    for i = 1, #entities do
        local entity = entities[i]
        if entity.Type == EntityType.ENTITY_PICKUP and entity.Variant == 100 then -- this should filter to only active or passive items
            local screenPosition = Isaac.WorldToScreen(entity.Position)
            local txt, color  = getSpins(entity.SubType, looking_for_id, cb)
            font:DrawString(txt, screenPosition.X-7, screenPosition.Y-15, color, 0, false)
            --Isaac.RenderText(txt, screenPosition.X-7, screenPosition.Y-15,1, 1, 1, 150)
        end
    end

end

local function onInput(entity, hook, button)
    if Input.IsButtonPressed(Keyboard.KEY_F1, 0) then
        showText = true
    else
        showText = false
    end
end

mod:AddCallback(ModCallbacks.MC_POST_RENDER, printText)
mod:AddCallback(ModCallbacks.MC_INPUT_ACTION, onInput, InputHook.IS_ACTION_PRESSED)