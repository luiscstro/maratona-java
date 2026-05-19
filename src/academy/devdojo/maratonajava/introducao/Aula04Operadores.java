package academy.devdojo.maratonajava.introducao;

public class Aula04Operadores {
    // + - / *
    static void main(String[] args) {
        int number01 = 10;
        double number02 = 20;
        double result = number01 / number02;
        System.out.println(result);

        // % (resto de uma divisão)
        int resto = 20 % 2;
        System.out.println(resto);

        /*
        Operadores Lógicos (retornam valores boleanos)
        < > (menor ou maior)
        <= >= (menor igual ou maior igual)
        == (Comparação)
        != (Diferente)
         */

        boolean isDezMaiorQueVinte = 10 > 20;
        boolean isDezMenorQueVinte = 10 < 20;
        boolean isDezIgualQueVinte = 10 == 20;
        boolean isDezIgualQueDez = 10 == 10;
        boolean isDezDiferenteQueDez = 10 != 10;
        System.out.println("isDezMaiorqueVinte "+isDezMaiorQueVinte);
        System.out.println("isDezMenorqueVinte "+isDezMenorQueVinte);
        System.out.println("isDezIgualqueVinte "+isDezIgualQueVinte);
        System.out.println("isDezIgualqueDez "+isDezIgualQueDez);
        System.out.println("isDezIgualqueDez "+isDezDiferenteQueDez);

        // && (AND) || (OR) ! (NOT)
        int idade = 29;
        float salario = 3500F;
        boolean isDentroDaLeiMaiorQueTrinta = idade >= 30 && salario >= 4612;
        boolean isDentroDaLeiMenorQueTrinta = idade < 30 && salario >= 3391;
        if (idade>30)
            System.out.println(isDentroDaLeiMaiorQueTrinta);
        if (idade<30)
            System.out.println(isDentroDaLeiMenorQueTrinta);

        double valorTotalContaCorrente = 200;
        double valorTotalContaPoupanca = 10000;
        float valorPlaystation = 3300.50F;
        boolean isPlaystationCincoCompravel = valorTotalContaCorrente > valorPlaystation || valorTotalContaPoupanca > valorPlaystation;
        System.out.println(isPlaystationCincoCompravel);

        // =  += -= *= /= %=
        double bonus = 1800; // 1800
        bonus += 1000; // 2800
        bonus -= 500; // 2300
        bonus *= 4; // 9200
        bonus /= 2; // 4600
        bonus %= 2; // 0
        System.out.println(bonus);

        // ++ --
        int contador = 0;
        contador++;
        System.out.println(contador);



   }
}

