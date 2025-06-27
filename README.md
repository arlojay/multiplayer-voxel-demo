# Boxel.cc

A voxel-based multiplayer game with no current goal, written in typescript.

![Random screenshot from the game](readme-assets/image.png)

## Reason
During the late 2022 to early 2024 years, an online rip of a certain block game was created which garnered a lot of attention, primarily among the population of students who did not have access to computers that could natively run Java. However, because it was a transpiled Java application, it was not natively built for the web and didn't use any modern acceleration techniques. It was slow, clunky, and was generally unenjoyable to play on.

The inevitable corporately-funded destruction of the project inspired me to develop my own game, or at least a framework, that could support the creativity poured into servers that ran many of the experiences people had.

## The Idea
This project started as an idea in early- to mid-2024. The original idea for the project was to be an online, multiplayer shooter game that teachers could use in classrooms as a 3d alternative to other study-minigame platforms like Gimkit and Blooket.

It was centered around the idea of two opposing teams of randomly divided players. Each team would have a sub-class of player, either offense or defense, which could go shoot other people or defend their own base respectively. It would be a CTF-style game with small "educational" intermissions whenever an offensive player died or defensive player obtained new blocks.

## Development
The development of this project started as an alternative courseload to a video game design class (its "advanced" counterpart was merged with the primary class and a new curriculum was created).

A project was created before, [voxel-visualizer](https://github.com/arlojay/voxel-visualizer), which was used as the backbone of this project. The voxel-visualizer project was itself created as a utility tool for a framework I made for terrain generation for a mod built on modding software for an indie game [Cosmic Reach](https://finalforeach.itch.io/cosmic-reach).

The code from [voxel-visualizer](https://github.com/arlojay/voxel-visualizer) was used to construct a very basic first-person demo of boxel.cc. Over the three months of the project's infancy, basic infrastructure was created for entity synchronization and world loading. Once the semester got out for the summer, development began on custom blocks and enriching server content.