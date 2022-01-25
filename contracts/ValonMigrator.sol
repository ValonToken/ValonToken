pragma solidity 0.8.7;
import { IBEP20 } from './interfaces/IBEP20.sol';
import { SafeBEP20 } from './libs/SafeBEP20.sol';
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ValonToken } from './ValonToken.sol';

contract ValonMigrator is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    ValonToken public valonToken;
    ValonToken public valonTokenOld;
    bool private _active = true;
    bool private _migrationAllowed = true;
    uint256 private _fee = 50000000000000000; // 0.05bnb
    uint256 private _percentage; // 0 - 100 percentage
    uint256 private _totalMigrated;
    uint256 private _totalClaimed;
    mapping(address => uint256) balanceVLON;
    mapping(address => uint256) migratedVLON;
    mapping(address => uint256) claimedVLON;
    mapping(address => bool) claimingAllowed;
    mapping(address => bool) blacklist;
    mapping(address => bool) whitelist;
    mapping(address => bool) viplist;

    constructor(
        ValonToken valonTokenAddressOld,
        ValonToken valonTokenAddress
    ) {
        valonTokenOld = valonTokenAddressOld;
        valonToken = valonTokenAddress;

        _importAddress(0xE6B907F037196516DbE14934046e186B94Af7D7d, 205898);
        _importAddress(0x95D6c3832818D81f0FeB61d47fff24698C81A369, 107142);
        _importAddress(0x1b35BF5A33a5CB7f5c003dCB16Df487cC1BD7422, 101779);
        _importAddress(0xa363F04791bcF96b1931aBfa4A349f4507a5AB68, 50516);
        _importAddress(0xfFfcd158966325a2416B5877608EE14Ec34120A3, 36689);
        _importAddress(0xB49451d8200315D7C4c140903b1CCC4D756927f3, 36662);
        _importAddress(0x8d8446616D27B59fbA66f7CEf949D81484c2bBe8, 35974);
        _importAddress(0xfd838C574ce445A6E16CCC3c19177ef0187B6a8D, 35392);
        _importAddress(0xBe360A0CB5C6341F6F26bC46b85B4a52A6f2c046, 33500);
        _importAddress(0xfF956E7Cc6d29816C315869CD4795a81E93413c8, 29145);
        _importAddress(0xFcf4e46BA3d987D51aD26a1C90ac8B521b29DE77, 24114);
        _importAddress(0x1f8ff2c14d72Eb6f0C6fE77A1363D35d6e313b47, 24083);
        _importAddress(0xD947bFf32ccD77D70D52FeE1340431F9086c5ED9, 23443);
        _importAddress(0x2F81B2731BeE794246Db724beC58cE5016625665, 23214);
        _importAddress(0x8020FC195e257886Cd1cD4D30d083D4f58B71e3E, 23076);
        _importAddress(0xA53E4375cD04AFC8b01B41441FdA50b00a82E6Ba, 23076);
        _importAddress(0x6e0ce9eF7974244D75999E7E79D98139410E7913, 20243);
        _importAddress(0x0941Ae5A513CC77c99dF2b8f9F35281003d49510, 17857);
        _importAddress(0x581Ae617f58668921a381B94EE0c0FE372CeF39A, 17457);
        _importAddress(0xd6550A793344fb9cdF28aACea4C310793d10979F, 17307);
        _importAddress(0x44E3Daf6bfa2905ea385cc56A4324819755B8FEe, 17015);
        _importAddress(0xe94df49916c84504534dE692711A0f6871c45981, 16107);
        _importAddress(0xAA0Cc7d3155dC2c8c6C0dD9c68718a16ceb2F1B0, 15525);
        _importAddress(0x1FEAd8D33F0c6eDb9e70EE006a1Da310f3bBe437, 15522);
        _importAddress(0xda5c002865dc64AdBA1EB8b7732a492F58638877, 15512);
        _importAddress(0x4Fd7f90C3C9eA13f26CD5BA79Fd2d5DBcA92132f, 14672);
        _importAddress(0x6935f08DB1069fd4d667FC92AF894E258E35e1a3, 14599);
        _importAddress(0x73E89bBf3836e8625b132aBF91A538a9b8c458f8, 14229);
        _importAddress(0xB02b66652c5c915Db3642555124d65dab78d75e9, 13736);
        _importAddress(0x173733c66c3d6ac47F0030F8aB6aBA96b292b8c7, 13371);
        _importAddress(0x79df0eB723d5Cd2BAedFd87BB5D9d74bD1594b53, 12598);
        _importAddress(0xF4f21Cd2ADd6a15a2468A67c011E65e96B066dBb, 11785);
        _importAddress(0xB84FF5443C338730a95EDbAe630E80b5EDa4EFcE, 11607);
        _importAddress(0xA48BB864da894686C1fE8578F91773d4fC140BE8, 11205);
        _importAddress(0x8cfcfb5d7b533082eFE608deA3c9083D812812A9, 10812);
        _importAddress(0xf9BE8Af9F649113a10529526e4c4dbe0f1F90289, 10714);
        _importAddress(0x1eFf8506b6ed6aB8b7c8824FdAe1d11738D19852, 10262);
        _importAddress(0xA76524Ee49C0b6976425b9B7c759692af90e0755, 10166);
        _importAddress(0xC5187b947B5dD43BC32b0A63F29b1fE80f345fCA, 9874);
        _importAddress(0xAa7F5Eea46ee7651856B4Bc556B326AbbFEB0FEd, 9818);
        _importAddress(0x2C2221006d6CAC6354B08995E656EBE33aD7f891, 9693);
        _importAddress(0xc84fae4176F248D06d13a0472D13aE4f45Aa10c9, 9334);
        _importAddress(0x69Ebaa28a3Ff4bf54C89ed7B77C5Efe38179B1b7, 9311);
        _importAddress(0x569b797FAB0B15206e45ABc4255C275dd9068a97, 9208);
        _importAddress(0xc343971a026ba24FdF62EC79FEFDbe6625167376, 9207);
        _importAddress(0x9d150185785eD8E01AAa713229C9d3f52eD81dC1, 9187);
        _importAddress(0x733dC75214292D916b071925F485F1eBF6A43c1F, 8985);
        _importAddress(0x74fdbE8C2AD7ECfF73a250FBE57292714308e410, 8928);
        _importAddress(0x2cd37419FEc45395Fe6b06781B93Ac3B93Bb3208, 8832);
        _importAddress(0xf3558b592629B7a16ae967751f8fF0f5d9cbe2d7, 8550);
        _importAddress(0xCA5b37afc70252d90bb25eB0FE77dc044eF93827, 8333);
        _importAddress(0xDAC749D5A2778525642d5C87E20c7eca11268Ab9, 8269);
        _importAddress(0x07Ce0a74714DF07Ef6afB73eCfb04952d10ac0FD, 8250);
        _importAddress(0x7dE06f5dE5C6f4a7B2b8B70670C0Ced4C74F6A34, 7912);
        _importAddress(0x1e26295474160A05b08dB40636044c2839d1dA9C, 7098);
        _importAddress(0x5e38ADbc65a77FC28ef9E89f152514388F570288, 6606);
        _importAddress(0x333409e70DF7735b75D3aB9D248D9c8bEA5fC647, 6545);
        _importAddress(0x9d6765b1Dd4Ff16F5469624767B00a3b5Ee910C3, 6445);
        _importAddress(0x1AB89BD869fe584Cc978FC8E16a0Ca227Eb61914, 6274);
        _importAddress(0xb97F9C6c4c0e9Fdf18FA132E4C39d2011eF1AAdB, 6195);
        _importAddress(0x8F0600a661AC7E5a312F9a57f760fA1F60775AF8, 6000);
        _importAddress(0x663601EC5026708Bb7854A457B9c3c43a43b5325, 5762);
        _importAddress(0x347F8bb59a405cA3D6b8A3769e5a40B95294c978, 5571);
        _importAddress(0x5afDAcA5d92F92D92940Db371B524206e82bd717, 5405);
        _importAddress(0xF16Ae463857e34126e98d5c34C49f2a6c8D49C19, 5361);
        _importAddress(0x6B609BE71dfDAB6601331aE8F760beC04bbe07Dd, 5357);
        _importAddress(0x43fdBab241a33330D17655c164e7231CB6dC7Fa0, 5160);
        _importAddress(0xa5a86B9ac8830c6Dee4B1749D4bD22E55Fe556a3, 5081);
        _importAddress(0xA8b67D6aF0a1214Be1dAB78E443847df015c4978, 4938);
        _importAddress(0x594D86cE164dC01DD16531F8294CE8FF08D0347B, 4666);
        _importAddress(0xc5bedFA3918EEab96f04576191Ffe4611751D7fb, 4625);
        _importAddress(0x8c6eebc61BbD60762c3F5719E4E71E7050E639B0, 4615);
        _importAddress(0x24B7853096F8085452C1CaA874EA0Bfe756b74E0, 4615);
        _importAddress(0x32E906B6c0e36a579B06F3cFDF1515170fACfb3e, 4540);
        _importAddress(0x192D77A38AACb709c42484b38e8af2D22f7e1e0d, 4500);
        _importAddress(0x1c6D17D448aFa5B1A29F772B99DB617D98440D53, 4488);
        _importAddress(0xF002727d1B6f4aFdA836A4A2F47F1C69c95ec920, 4403);
        _importAddress(0xDD23d989b370e39d0DBF0Ad51070CAb087a2dAdc, 4315);
        _importAddress(0xFA7553B472EF2A29Cba9cF90c002781c94B24e63, 4285);
        _importAddress(0xA269cCEC360Bb6456eFEd87E62E03d7D6C43eef4, 4200);
        _importAddress(0xa9bfe884bFAa12291C53a9F7fb4b577E2e006d0B, 4181);
        _importAddress(0x36B0eE89dd4b2378B18c0360B155b3bf5E05a325, 3849);
        _importAddress(0xdF243fEF6b66e1716148DaFFD6918D8da39A566d, 3798);
        _importAddress(0x8CdB2986fA50b99CCCBA41882272a2626E5C5095, 3768);
        _importAddress(0x89baa0171Fe50Bb10b48b31BD90960128B607271, 3750);
        _importAddress(0x51fD826F08247B0840FEe9db8C5916F51F29697F, 3678);
        _importAddress(0x4c67a56D57731Bc8D638c35f6E93e9380DF3d7B4, 3600);
        _importAddress(0x1f39A3b08ee869235F0C392aDE853E39B82a5D5f, 3571);
        _importAddress(0xe1EcF8EF96A4A01E1cB713321564530DC3165A8C, 3571);
        _importAddress(0xbd8A5EC9C883a3D1d6d1846F7a9Fdbcb7158E0F9, 3413);
        _importAddress(0xe58d29Fe9097818B75eC7274809074393B53444a, 3282);
        _importAddress(0xE64ACA1105d0c4B82666cD8F7d0dcc1943a86E9D, 3185);
        _importAddress(0x50A22EB6043B14cE7016f2627f546c20FD6216e7, 3171);
        _importAddress(0xDBD2ECf2571646342676b97144286d27388BE98A, 3105);
        _importAddress(0xfB4Cc7310b818CCaCf2b85839A7DD6323889b7a0, 3066);
        _importAddress(0x1C512E43dEAB3256D0D8Dc7Cc49B48363FB5A77f, 3003);
        _importAddress(0x9998576a8b152Ca58Bad3f0cA3EED82A5C8735f4, 2908);
        _importAddress(0x33F9D0e63FC5A48BFe35Cabd3D1A2209De469087, 2900);
        _importAddress(0x0B4b91C8c8e377C7988C262dFC2C65Fa96681D93, 2829);
        _importAddress(0xAd1b2656aa34e860b3eeCe110DA4cA66e56B288b, 2826);
        _importAddress(0xbA5c4A238BE526Fa00D99dE1996ca7467C856574, 2730);
        _importAddress(0x66be41274296dF1912F0c6f62DcEc9066e9dD166, 2697);
        _importAddress(0xdCB3eA6Dd9079Df724Da7D929910817E36ac168c, 2649);
        _importAddress(0x5f0Be7821242c09cfA6476f9e1778a8BB4f0d788, 2490);
        _importAddress(0xBDE62cbb39995CC32C1Cd177F8F7400A9950695E, 2408);
        _importAddress(0xF5380811A1a4c0461a22f812Ce9338e1A094b0C8, 2400);
        _importAddress(0x84adCb25674eF99A4B56026e29A85B029A20656d, 2383);
        _importAddress(0xfB6296533BE083F499E8Cc19553e00CAAF789D91, 2376);
        _importAddress(0x514707375CEda3F531E511f034275f78d786F617, 2307);
        _importAddress(0x01B0BeCf4DFBe0Cb620118986eb2459a52177CE6, 2307);
        _importAddress(0x94079EfB1F7755406ebe27979b6CB825377d81Ab, 2215);
        _importAddress(0x1147fA929462d62395f2F990BA8E1436CA7ba571, 2215);
        _importAddress(0x31d45a63D82f6Fc9871a91477b5aeE1673942985, 2192);
        _importAddress(0x222F32192637747Be2494a557D2ab949dA5C7fA5, 2138);
        _importAddress(0x36cA9eE216066ab7119D60D21D8AfD4C9fE0b9f6, 2120);
        _importAddress(0xB67F3CfD77C444Cd3b6841595d767d0abCA6CB5c, 2117);
        _importAddress(0xfE0275F4293156686C22d127e70Ad2de8aeDf13A, 2112);
        _importAddress(0x9E3478df1C8429Da92A28b1ccCa3fD8d4C7C8832, 2075);
        _importAddress(0x2ed085a1349F2Ec23eEe6fa5D0fD5fC459b2e8DD, 2041);
        _importAddress(0xC64CCE81DB7a0f46071A563a1563aC10242a5CFA, 1991);
        _importAddress(0x2A74F5DA9047F44aBEE98483adF0cEb4018F6d5F, 1964);
        _importAddress(0xC65A7eAa5F0b1a2752C50036C3F3625bcad1e745, 1905);
        _importAddress(0x260b64692A7C9d27a8eBA9BA97b85A97B46838CE, 1825);
        _importAddress(0x979e939492FD05Fcb4267dD2658897Bb918157F4, 1785);
        _importAddress(0xd4c0D2edE08e84fA0F51f41fBDfAfD4B42F8353d, 1785);
        _importAddress(0x61b2a1adD38F550594d357Ee937707a8F772dbE7, 1785);
        _importAddress(0xaDf26375d2EaB661bd7EA1C54Eb1bcaFE18fADb8, 1785);
        _importAddress(0x1D6f49b38f36F9C015856Ec799bB2B291808A2A8, 1785);
        _importAddress(0x1a197180b3ba7C1FE8A40E94244F5c0b15e82F8f, 1785);
        _importAddress(0x8D4c1993c5f0e3f87253B2640490fbd5b55d4DCF, 1750);
        _importAddress(0x1A713A330172B627e84E935154A171362672B950, 1750);
        _importAddress(0x2E910E8b74b766aea0062b67E06D640719D378A8, 1696);
        _importAddress(0x5B55E1A666F1817928949F44F3bc7A173827415A, 1629);
        _importAddress(0xa5B0FbB239C7fD7B22A50756C4fc3fd987EBb56C, 1626);
        _importAddress(0x6c6190D528ff6106982FC6DC992EBF8A0c223F79, 1610);
        _importAddress(0xf36f6763Bc9A617456e25e565e26E31f6D028586, 1560);
        _importAddress(0x8169342cda220bDB996FA287534846Fee7e20845, 1521);
        _importAddress(0x99735A8d4Dc5B55aE711dA211DA43e864a605f60, 1496);
        _importAddress(0x5930C07E691fE1657dBD10c948bC7Cc17136028e, 1463);
        _importAddress(0xa19CF30FF1Ab0C21953822Aae847A1012B0CD722, 1396);
        _importAddress(0x700B9a0994ACFA2dFd60C1E17662C0158D49Aca1, 1361);
        _importAddress(0x33386ED9Cdd9A4173F0856c8e2CCdF90Fc270800, 1358);
        _importAddress(0x975d6F96b7E36e094c0b29D01C7e1cf76A9ba973, 1336);
        _importAddress(0x48bf2329410F2C4e4471b83b151f3A44E00c7cB1, 1300);
        _importAddress(0x0B9A4277b93d7AC384Bd7D998B8c956615B19111, 1271);
        _importAddress(0x6DFF786C9e57B060160a3Ca31B81a3EA42318239, 1269);
        _importAddress(0xb4605750c0871C8C139E04a2e0Bf63e1C8c40F58, 1170);
        _importAddress(0xDa022017377c00bc19fe70DB82774BE3959930e1, 1107);
        _importAddress(0x492a938Bc480519E8E146349E4e9529866545DeF, 1052);
        _importAddress(0xDe4591f8Eb336B8443F7573508f515b48D981f9d, 1013);
        _importAddress(0xF0dda1B8C64b6d22DfCC9405e66B12c2d21641b2, 1000);
        _importAddress(0x4d308053De495F2446ef3b55724FCd7eAc2AA4B2, 995);
        _importAddress(0xb458e195C3837daf4F940dc6f2c39688D26c1881, 946);
        _importAddress(0xD9579E7BF89935f75b6E729159b7fb447073e10A, 942);
        _importAddress(0x5988f62A61B6496999c0F4BCC8B388c64e0Ff099, 918);
        _importAddress(0x005a23AE6FDC792A7c32910eD0274B3c3098865a, 844);
        _importAddress(0xb612b37a5D906F5574a8118ac12Da5F9C799b943, 823);
        _importAddress(0xf3822C4CEdce776c548d7315f4382D2b314CEf19, 823);
        _importAddress(0x511Ea80aFBaD89d37012dA43962a5D74CF131E12, 821);
        _importAddress(0x1FB95A78C6Ba806d01047515709C365d72B6E9d8, 812);
        _importAddress(0x0E5e47fD4b9883889B01Dfb0D668B75C4b81c6ed, 802);
        _importAddress(0x079477E27C9DF85b0d03Ef246161a99134C72616, 782);
        _importAddress(0xdb4a1463014116628fFA8a41AC7AC68C1A2126D6, 749);
        _importAddress(0xf81186b6e272c09d5235eEE8ce825dB6E444521d, 717);
        _importAddress(0xB98459598A5844FcEe3cA133329002Cc7366CBB7, 692);
        _importAddress(0xCE027FA1c109223CE7378efB902e970daA044Ab9, 642);
        _importAddress(0x7E9CA095464a95949cA64acc8939831A140E514e, 616);
        _importAddress(0x84feb9f8855174956b272DE67F462e2AA3a54fA1, 612);
        _importAddress(0x378dFbD2008320EDB7F101935696a03d61F3349A, 600);
        _importAddress(0xa43936419C56e1e2ad514f02d6752ff79F27FeC1, 575);
        _importAddress(0x40088e0Cd1114f2b8291ac81a993e017E66413E4, 557);
        _importAddress(0x3829646624436F5F52fb803Fc1D466e8Fbe65ab4, 462);
        _importAddress(0x0C043eE751B5e16e0B3EaCd69B950052b7c77ab8, 461);
        _importAddress(0x11195290E0898bB7afF66b1f1B8AcD7e1E0A5382, 461);
        _importAddress(0xF91B7cA9f5e4374D649B24aC9256028cA8CF3810, 440);
        _importAddress(0x2E98F288C2B443a0DbA1b24eCDc5F805C82B2Cf5, 417);
        _importAddress(0x4B69E7235DFbF326030515E19E3fB02EB6ca9492, 405);
        _importAddress(0xdCC9f5281B8bb40B11A792C280aA2cdd434C34AF, 404);
        _importAddress(0x6362ea58D3C82C15bd4Bdc2E51104399Edb3c110, 375);
        _importAddress(0x79BEd2cc0294c2aeD47403aE2185629194b33E75, 360);
        _importAddress(0x8f2943ed8991502c0139681F7c3d1e2499BeCF76, 357);
        _importAddress(0x5054aa7F3698B3263271fa5a415b13c9990ab326, 352);
        _importAddress(0x04B3D83d593ec5F797feCFC0BA0d49621c8A42DD, 336);
        _importAddress(0x5a9a1B04E29A1E27832744F2A35ed4b1220C1f91, 335);
        _importAddress(0xCb7914F6b4030a34DC5910d5A3111878EF9D1Afa, 300);
        _importAddress(0x524015B7553D9E2d829DB14737F79387C88119AF, 272);
        _importAddress(0xA35fF0cc7c6842060C94e33bA4a96a6b091357f3, 266);
        _importAddress(0x790C9e6246a573af6923A3a25b175C15FC854F48, 259);
        _importAddress(0x369374a467B6FB4DA46Eb669481d9f9210a27dE6, 245);
        _importAddress(0xB8D473B2a19F1d365103897654C44B8FC7eB9feA, 230);
        _importAddress(0xbd96Be9dfb767A2b2C2Bd6b540766e2B80E6286D, 219);
        _importAddress(0xaD6155E593c90a72Ad7Da66e343640A7D37A028c, 216);
        _importAddress(0x233e3037299a60AC77Fa838De8f6Fc91D281AB55, 213);
        _importAddress(0xdF53FF686B01656A5744bd810520808A809EB45f, 212);
        _importAddress(0xce9E7E1F3334E3dE213a6DC873df324624547a26, 200);
        _importAddress(0x344bb5161EAE3e32Fe3dc0b4b8212b066089Ca94, 186);
        _importAddress(0x15Af2d1ff12c3093BB82BaBBCF0003F3Ea610f16, 175);
        _importAddress(0x9127D018483ba8e742499FE2E472E384Ca7F0DCc, 173);
        _importAddress(0x5dE5e6bF4C6790C683B62EF333eD6d74EB37ea04, 165);
        _importAddress(0xb54841a9672064cf56f8AD47F46bE2A13F8c7147, 162);
        _importAddress(0x11dCA5F8Ff9Fe9EF14496B7eb4c99E915E0e45cA, 158);
        _importAddress(0xdCD7A464278E3c5b03a6F5e5BaF0a8429DA294C8, 150);
        _importAddress(0x4904f153370189100b473f3f3bfD573da9D8b6b9, 134);
        _importAddress(0x90866Dd1E733af642d56938dC6998670D8cBF183, 128);
        _importAddress(0x51b3918307DE61cBC2b66A4d1b4ecbCDcd831B6A, 126);
        _importAddress(0x9aefBBAA9e9c60F352359b1e8b2e4EDBD0dcCFEd, 102);
        _importAddress(0x7FED123bEeE227Ec4d6A9b9d25cC1E3124005E1e, 100);
        _importAddress(0xBBab76e319c6A4051fF525bCA7F066617885e073, 100);
        _importAddress(0x74F25C1908dc4bd62b8D4983Ee3D9090Bf4C5F29, 100);
        _importAddress(0x7D68B90FCE081521C92e1B3892aC06e2bc6EFE4f, 100);
        _importAddress(0x1AC508cC36B48Bfb0BdeDeD472bB0b0f6a58b1b5, 100);
        _importAddress(0x84655f5a35B5d05622b5bdB245E1fa6fD8D69AEb, 100);
        _importAddress(0xf1119A8A338859706EED9ae221D9EB4Fa492Fc14, 100);
        _importAddress(0x1ff46BB66ad3a898F2942F84848AF22dBfeC057F, 100);
        _importAddress(0xE30a294F977CeBb772f39BC4C12590E221Ff7607, 100);
        _importAddress(0x1404e5F8f5c3b14BfFC2E105007173153B766ec0, 100);
        _importAddress(0x3193325E1811B030215D957bB315a2827403d932, 100);
    }

    receive() external payable nonReentrant {
        migrate();
    }

    /*
    *   MIGRATE
    * * * * * * * * * */
    function setVestingPercentage(uint256 percentage) public onlyOwner {
        _percentage = percentage;
    }

    function setFee(uint256 valueWei) public onlyOwner {
        _fee = valueWei;
    }

    function setMigrated(address _address, uint256 valueWei) public onlyOwner {
        migratedVLON[_address] = valueWei;
    }

    function setClaimingAllowed(address _address, bool value) public onlyOwner {
        claimingAllowed[_address] = value;
    }

    function setMigrationAllowed(bool value) public onlyOwner {
        _migrationAllowed = value;
    }

    function setBlacklisted(address _address, bool value) public onlyOwner {
        blacklist[_address] = value;
    }

    function setWhitelisted(address _address, bool value) public onlyOwner {
        whitelist[_address] = value;
    }

    function setViplisted(address _address, bool value) public onlyOwner {
        viplist[_address] = value;
    }

    function withdrawBNB(uint256 amount) public onlyOwner {
        (bool succeed, /*bytes memory data*/) = owner().call{value: amount}("");
        require(succeed, "Failed to withdraw Ether");
    }

    function getBlacklisted(address _address) public view returns(bool) {
        return blacklist[_address];
    }

    function getWhitelisted(address _address) public view returns(bool) {
        return whitelist[_address];
    }

    function getViplisted(address _address) public view returns(bool) {
        return viplist[_address];
    }

    function migrate() public payable nonReentrant {
        require(valonTokenOld.balanceOf(msg.sender) > 0, "No VLON Found");
        require(migratedVLON[msg.sender] == 0, "Already migrated");
        require(_active, "Migration has already finished");
        require(_migrationAllowed, "Migration not allowed");
        if (!whitelist[msg.sender]) {
            require(msg.value >= _fee, "Fee required");
        }

        uint256 amountVLON = valonTokenOld.balanceOf(msg.sender);
        require(valonTokenOld.transferFrom(msg.sender, owner(), amountVLON), "Transaction failed");
        migratedVLON[msg.sender] = amountVLON;
        _totalMigrated = _totalMigrated.add(amountVLON);
    }

    function claimMigratedVLON() public nonReentrant {
        require(migratedVLON[msg.sender] > 0, "No VLON to migrate");
        require(!blacklist[msg.sender], "Blacklisted for breaking the rules");
        require(_active, "Migration has already finished");
        require(claimingAllowed[msg.sender], "You are not allowed to claim");
        require(_percentage > 0, "Migration not configured");

        uint256 amountVLON = migratedVLON[msg.sender].div(100).mul(_percentage);
        amountVLON = amountVLON.sub(claimedVLON[msg.sender]);

        if (viplist[msg.sender]) {
            amountVLON = migratedVLON[msg.sender];
        }

        require(amountVLON > 0, "Error migrating");

        claimedVLON[msg.sender] = claimedVLON[msg.sender].add(amountVLON);
        require(valonToken.transferFrom(owner(), msg.sender, amountVLON), "Transaction failed");
        _totalClaimed = _totalClaimed.add(amountVLON);
    }

    function getMigratedVLON(address _address) public view returns(uint256) {
        return migratedVLON[_address];
    }

    function getClaimedVLON(address _address) public view returns(uint256) {
        return claimedVLON[_address];
    }

    function getClaimingAllowed(address _address) public view returns(bool) {
        return claimingAllowed[_address];
    }

    function getTotalMigratedVLON() public view returns(uint256) {
        return _totalMigrated;
    }

    function getTotalClaimedVLON() public view returns(uint256) {
        return _totalClaimed;
    }

    function getMigrationAllowed() public view returns(bool) {
        return _migrationAllowed;
    }

    function getActive() public view returns(bool) {
        return _active;
    }

    function getFee() public view returns(uint256) {
        return _fee;
    }

    function getClaimableVLON(address _address) public view returns(uint256) {
        uint256 amountVLON = migratedVLON[_address].div(100).mul(_percentage);
        amountVLON = amountVLON.sub(claimedVLON[_address]);
        return amountVLON;
    }

    function getPercentage() public view returns(uint256) {
        return _percentage;
    }

    function _to18Digits(uint256 num, uint decimalz) pure private returns (uint256) {
        return num * (10**(18 - decimalz));
    }

    function _importAddress(address _address, uint256 valueEth) private {
        migratedVLON[_address] = _to18Digits(valueEth, 0);
        claimingAllowed[_address] = true;
    }
}